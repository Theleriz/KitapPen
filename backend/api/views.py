import base64
import io
from datetime import datetime, timedelta
import mimetypes
from django.utils import timezone
from django.db.models import Sum, Count, Avg
from django.contrib.auth.models import User
from django.http import StreamingHttpResponse
from django.conf import settings
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.exceptions import TokenError

from .models import Book, Note, ReadingSession, UserNotificationSettings, UserProfile
from .serializers import (
    RegisterSerializer, UserSerializer, UserProfileUpdateSerializer,
    BookSerializer, BookDetailSerializer,
    NoteSerializer, ReadingPingRequestSerializer,
    ReadingPingResponseSerializer, ReadingStopSerializer,
    ReadingStatsSerializer, NotificationSettingsSerializer,
    ReadingSessionListSerializer
)
from .detector import analyze_frame

class IsModeratorUser(permissions.BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_staff or request.user.is_superuser:
            return True
        try:
            return request.user.profile.role == 'moderator'
        except Exception:
            return False


# MinIO imports (optional - install minio package)
try:
    from minio import Minio
    from minio.error import S3Error
    MINIO_AVAILABLE = True
except ImportError:
    MINIO_AVAILABLE = False


# ==================== AUTH ====================

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            UserNotificationSettings.objects.create(user=user)
            UserProfile.objects.create(user=user, role='reader')
            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh)
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(TokenObtainPairView):
    pass


class RefreshTokenView(TokenRefreshView):
    pass


class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        serializer = UserProfileUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(UserSerializer(request.user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    refresh_token = request.data.get('refresh')
    if not refresh_token:
        return Response({'detail': 'Refresh token required.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
    except TokenError:
        return Response({'detail': 'Invalid or already blacklisted token.'}, status=status.HTTP_400_BAD_REQUEST)
    return Response(status=status.HTTP_205_RESET_CONTENT)


# ==================== BOOKS ====================

class BookListCreateView(generics.ListCreateAPIView):
    serializer_class = BookSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        # My Library list (uploaded/owned by the current user)
        return Book.objects.filter(user=self.request.user, is_public=False)

    def perform_create(self, serializer):
        # Upload into My Library
        book = serializer.save(user=self.request.user, is_public=False, last_page=0)
        # TODO: Upload to MinIO here if configured
        return book


class PublicBooksView(generics.ListAPIView):
    """Library (admin/public catalog)."""
    serializer_class = BookSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Book.objects.filter(is_public=True)


class MyBooksView(generics.ListAPIView):
    """My Library (current user's private books)."""
    serializer_class = BookSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Book.objects.filter(user=self.request.user, is_public=False)


class AddPublicBookToMyLibraryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        try:
            public_book = Book.objects.get(pk=pk, is_public=True)
        except Book.DoesNotExist:
            return Response({'error': 'Public book not found'}, status=status.HTTP_404_NOT_FOUND)

        # If the user already added this exact file, return existing record.
        existing_qs = Book.objects.filter(user=request.user, is_public=False)
        if public_book.minio_path:
            existing_qs = existing_qs.filter(minio_path=public_book.minio_path)
        elif public_book.pdf_file:
            existing_qs = existing_qs.filter(pdf_file=public_book.pdf_file.name)
        existing = existing_qs.first()
        if existing:
            return Response(BookSerializer(existing).data, status=status.HTTP_200_OK)

        user_book = Book.objects.create(
            user=request.user,
            title=public_book.title,
            author=public_book.author,
            pdf_file=public_book.pdf_file,
            minio_path=public_book.minio_path,
            total_pages=public_book.total_pages,
            last_page=0,
            is_public=False,
        )
        return Response(BookSerializer(user_book).data, status=status.HTTP_201_CREATED)


class BookDetailDeleteView(generics.RetrieveDestroyAPIView):
    serializer_class = BookDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Book.objects.filter(user=self.request.user)


class BookStreamView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            book = Book.objects.get(pk=pk, user=request.user)
        except Book.DoesNotExist:
            return Response({'error': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)

        # If MinIO is configured and book has minio_path, stream from MinIO
        if MINIO_AVAILABLE and book.minio_path:
            try:
                minio_client = Minio(
                    "localhost:9000",
                    access_key="minioadmin",
                    secret_key="minioadmin",
                    secure=False
                )
                bucket_name = "books"
                object_name = book.minio_path

                response = minio_client.get_object(bucket_name, object_name)
                return StreamingHttpResponse(
                    response.stream(32 * 1024),
                    content_type='application/pdf'
                )
            except Exception as e:
                # Fallback to local file if MinIO fails
                pass

        # Stream from local file
        if book.pdf_file:
            def file_iterator(file, chunk_size=8192):
                with open(file.path, 'rb') as f:
                    while chunk := f.read(chunk_size):
                        yield chunk

            content_type, _ = mimetypes.guess_type(book.pdf_file.name)
            content_type = content_type or 'application/octet-stream'
            response = StreamingHttpResponse(
                file_iterator(book.pdf_file),
                content_type=content_type
            )
            filename = book.pdf_file.name.split("/")[-1]
            response['Content-Disposition'] = f'inline; filename="{filename}"'
            return response

        return Response({'error': 'No PDF file available'}, status=status.HTTP_404_NOT_FOUND)


class UpdateLastPageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            book = Book.objects.get(pk=pk, user=request.user)
        except Book.DoesNotExist:
            return Response({'error': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)
        fields = []
        page = request.data.get('last_page')
        if page is not None and int(page) > book.last_page:
            book.last_page = int(page)
            fields.append('last_page')
        total_pages = request.data.get('total_pages')
        if total_pages is not None and book.total_pages == 0:
            book.total_pages = int(total_pages)
            fields.append('total_pages')
        if fields:
            book.save(update_fields=fields)
        return Response({'last_page': book.last_page, 'total_pages': book.total_pages})


# ==================== NOTES ====================

class NoteListCreateView(generics.ListCreateAPIView):
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Note.objects.filter(user=self.request.user)
        book_id = self.request.query_params.get('book')
        if book_id:
            queryset = queryset.filter(book_id=book_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class NoteDetailUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Note.objects.filter(user=self.request.user)


# ==================== READING ====================

class ReadingPingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ReadingPingRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        frame = serializer.validated_data['frame']
        session_id = serializer.validated_data.get('session_id')
        book_id = serializer.validated_data.get('book_id')

        # Detect reading from frame
        is_reading, confidence = analyze_frame(frame)

        session = None
        total_seconds = 0

        if session_id:
            try:
                session = ReadingSession.objects.get(
                    id=session_id,
                    user=request.user,
                    is_active=True
                )
            except ReadingSession.DoesNotExist:
                pass

        if is_reading:
            if not session:
                # Start new session
                book = None
                if book_id:
                    try:
                        book = Book.objects.get(id=book_id, user=request.user)
                    except Book.DoesNotExist:
                        pass
                session = ReadingSession.objects.create(
                    user=request.user,
                    book=book,
                    is_active=True
                )
            else:
                session.total_seconds += 2
                session.save()
            session_id = session.id
            total_seconds = session.total_seconds
        else:
            # If not reading and has session, don't count but keep session
            if session:
                session_id = session.id
                total_seconds = session.total_seconds
            else:
                session_id = None

        return Response({
            'ok': True,
            'reading': is_reading,
            'confidence': round(confidence, 2),
            'session_id': session_id,
            'total_seconds': total_seconds
        })


class ReadingStopView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ReadingStopSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        session_id = serializer.validated_data['session_id']

        try:
            session = ReadingSession.objects.get(
                id=session_id,
                user=request.user,
                is_active=True
            )
            session.is_active = False
            session.ended_at = timezone.now()
            session.save()
            return Response({
                'ok': True,
                'total_seconds': session.total_seconds
            })
        except ReadingSession.DoesNotExist:
            return Response(
                {'error': 'Active session not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class ReadingSessionsListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        page = max(1, int(request.query_params.get('page', 1)))
        page_size = min(50, max(1, int(request.query_params.get('page_size', 5))))

        sessions = ReadingSession.objects.filter(
            user=request.user,
            is_active=False,
        )
        total = sessions.count()
        offset = (page - 1) * page_size
        serializer = ReadingSessionListSerializer(
            sessions[offset:offset + page_size], many=True
        )
        return Response({
            'results': serializer.data,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': max(1, (total + page_size - 1) // page_size),
        })


class ReadingWeekView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models.functions import TruncDate
        today = timezone.now().date()
        start_of_week = today - timedelta(days=today.weekday())

        sessions = ReadingSession.objects.filter(
            user=request.user,
            is_active=False,
            started_at__date__gte=start_of_week,
        )

        daily = (
            sessions
            .annotate(day=TruncDate('started_at'))
            .values('day')
            .annotate(total=Sum('total_seconds'))
        )
        days_map = {entry['day']: entry['total'] for entry in daily}

        result = [
            {
                'date': (start_of_week + timedelta(days=i)).isoformat(),
                'total_seconds': days_map.get(start_of_week + timedelta(days=i), 0),
            }
            for i in range(7)
        ]
        return Response({'days': result})


class ReadingStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        # Calculate streak (consecutive days with reading sessions)
        sessions = ReadingSession.objects.filter(
            user=user,
            is_active=False
        ).order_by('-started_at')

        total_seconds = sessions.aggregate(total=Sum('total_seconds'))['total'] or 0
        sessions_count = sessions.count()
        avg_per_day = 0
        streak_days = 0

        if sessions_count > 0:
            # Calculate streak
            unique_days = set()
            for session in sessions:
                day = session.started_at.date()
                unique_days.add(day)

            # Sort days and count consecutive
            sorted_days = sorted(unique_days, reverse=True)
            if sorted_days:
                streak_days = 1
                today = timezone.now().date()
                for i, day in enumerate(sorted_days):
                    if i == 0:
                        if (today - day).days > 1:
                            streak_days = 0
                            break
                    elif i > 0:
                        if (sorted_days[i-1] - day).days == 1:
                            streak_days += 1
                        else:
                            break

            # Calculate average per day
            if len(unique_days) > 0:
                avg_per_day = total_seconds / len(unique_days)

        return Response({
            'total_seconds': total_seconds,
            'streak_days': streak_days,
            'avg_per_day': round(avg_per_day, 2),
            'sessions_count': sessions_count
        })


# ==================== NOTIFICATIONS ====================

class NotificationSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        settings_obj, _ = UserNotificationSettings.objects.get_or_create(user=request.user)
        serializer = NotificationSettingsSerializer(settings_obj)
        return Response(serializer.data)

    def put(self, request):
        settings_obj, _ = UserNotificationSettings.objects.get_or_create(user=request.user)
        serializer = NotificationSettingsSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class NotificationSendView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        from django.core.mail import send_mail
        from django.contrib.auth.models import User as AuthUser

        subject = request.data.get('subject', '').strip()
        message = request.data.get('message', '').strip()
        user_ids = request.data.get('user_ids', [])

        if not subject or not message:
            return Response(
                {'error': 'subject and message are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if user_ids:
            users = AuthUser.objects.filter(id__in=user_ids, email__gt='')
        else:
            users = AuthUser.objects.filter(
                notification_settings__email_notifications_enabled=True
            ).exclude(email='')

        sent = []
        failed = []
        for user in users:
            html = f"""<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;max-width:560px;margin:40px auto;color:#333">
  <h2 style="color:#4a90e2">📚 KitapPen</h2>
  <p>Привет, <strong>{user.username}</strong>!</p>
  <p style="line-height:1.6">{message}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#999">BookTracker — твой любимый трекер для чтения</p>
</body></html>"""
            try:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    html_message=html,
                    fail_silently=False,
                )
                sent.append(user.username)
            except Exception as e:
                failed.append({'user': user.username, 'error': str(e)})

        return Response({'sent': sent, 'failed': failed})


# ==================== LEADERBOARD ====================

class ReadingLeaderboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models.functions import TruncDate

        # Top 10 by total read time
        time_qs = (
            ReadingSession.objects
            .filter(is_active=False)
            .values('user__id', 'user__username')
            .annotate(total_seconds=Sum('total_seconds'))
            .order_by('-total_seconds')[:10]
        )
        time_leaders = [
            {
                'user_id': e['user__id'],
                'username': e['user__username'],
                'total_seconds': e['total_seconds'],
                'is_current_user': e['user__id'] == request.user.id,
            }
            for e in time_qs
        ]

        # Top 10 by day streak — compute per user
        today = timezone.now().date()
        user_days_qs = (
            ReadingSession.objects
            .filter(is_active=False)
            .annotate(day=TruncDate('started_at'))
            .values('user__id', 'user__username', 'day')
            .distinct()
        )

        buckets: dict = {}
        for entry in user_days_qs:
            uid = entry['user__id']
            if uid not in buckets:
                buckets[uid] = {'username': entry['user__username'], 'days': set()}
            buckets[uid]['days'].add(entry['day'])

        streak_leaders = []
        for uid, data in buckets.items():
            sorted_days = sorted(data['days'], reverse=True)
            streak = 0
            if sorted_days and (today - sorted_days[0]).days <= 1:
                streak = 1
                for i in range(1, len(sorted_days)):
                    if (sorted_days[i - 1] - sorted_days[i]).days == 1:
                        streak += 1
                    else:
                        break
            streak_leaders.append({
                'user_id': uid,
                'username': data['username'],
                'streak_days': streak,
                'is_current_user': uid == request.user.id,
            })

        streak_leaders.sort(key=lambda x: x['streak_days'], reverse=True)
        streak_leaders = streak_leaders[:10]

        return Response({
            'time_leaders': time_leaders,
            'streak_leaders': streak_leaders,
        })


# ==================== MODERATOR ====================

class ModeratorBookListCreateView(APIView):
    permission_classes = [IsModeratorUser]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        books = Book.objects.filter(is_public=True)
        serializer = BookSerializer(books, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = BookSerializer(data=request.data)
        if serializer.is_valid():
            book = serializer.save(user=request.user, is_public=True, last_page=0)
            return Response(BookSerializer(book).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsModeratorUser])
def moderator_book_delete_view(request, pk):
    try:
        book = Book.objects.get(pk=pk, is_public=True)
    except Book.DoesNotExist:
        return Response({'error': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)
    book.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

import base64
import io
from datetime import datetime, timedelta
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

from .models import Book, Note, ReadingSession, UserNotificationSettings
from .serializers import (
    RegisterSerializer, UserSerializer,
    BookSerializer, BookDetailSerializer,
    NoteSerializer, ReadingPingRequestSerializer,
    ReadingPingResponseSerializer, ReadingStopSerializer,
    ReadingStatsSerializer, NotificationSettingsSerializer
)

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


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def me_view(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    return Response({'message': 'Successfully logged out.'}, status=status.HTTP_200_OK)


# ==================== BOOKS ====================

class BookListCreateView(generics.ListCreateAPIView):
    serializer_class = BookSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return Book.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        book = serializer.save(user=self.request.user)
        # TODO: Upload to MinIO here if configured
        return book


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

            response = StreamingHttpResponse(
                file_iterator(book.pdf_file),
                content_type='application/pdf'
            )
            response['Content-Disposition'] = f'inline; filename="{book.title}.pdf"'
            return response

        return Response({'error': 'No PDF file available'}, status=status.HTTP_404_NOT_FOUND)


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

# Simple "reading detection" - checks if frame contains any content
# In real implementation, this would use ML/CV to detect if user is reading
def detect_reading_from_frame(frame_base64):
    """
    Mock implementation of reading detection.
    In production, this would use computer vision to detect:
    - If book is open in front of camera
    - If user is looking at the book
    - If lighting conditions are good
    """
    try:
        # Decode base64 and check if frame is valid
        frame_data = base64.b64decode(frame_base64)
        if len(frame_data) > 1000:  # Simple check for valid image data
            # Mock: 80% chance user is reading
            import random
            confidence = random.uniform(0.6, 0.95)
            is_reading = confidence > 0.7
            return is_reading, confidence
        return False, 0.0
    except Exception:
        return False, 0.0


class ReadingPingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ReadingPingRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        frame = serializer.validated_data['frame']
        session_id = serializer.validated_data.get('session_id')

        # Detect reading from frame
        is_reading, confidence = detect_reading_from_frame(frame)

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
                session = ReadingSession.objects.create(
                    user=request.user,
                    is_active=True
                )
            else:
                # Update session time (assuming ping every 5 seconds)
                session.total_seconds += 5
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

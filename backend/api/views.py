import base64
import io
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Sum, Count, Avg
from django.contrib.auth.models import User
from django.http import StreamingHttpResponse
from rest_framework import status, generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import Book, Note, ReadingSession
from .serializers import (
    RegisterSerializer, UserSerializer,
    BookSerializer, BookDetailSerializer,
    NoteSerializer, ReadingPingRequestSerializer,
    ReadingPingResponseSerializer, ReadingStopSerializer,
    ReadingStatsSerializer
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

try:
    import cv2
    import mediapipe as mp
    CV_AVAILABLE = True
except ImportError:
    CV_AVAILABLE = False

_face_mesh = None
_cv_executor = ThreadPoolExecutor(max_workers=2)


def _get_face_mesh():
    global _face_mesh
    if _face_mesh is None:
        _face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
        )
    return _face_mesh


def detect_reading_from_frame(frame_base64):
    if not CV_AVAILABLE:
        import random
        confidence = random.uniform(0.6, 0.95)
        return confidence > 0.7, confidence

    try:
        img_bytes = base64.b64decode(frame_base64)
        arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return False, 0.0

        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = _get_face_mesh().process(rgb)

        if not results.multi_face_landmarks:
            return False, 0.0

        lm = results.multi_face_landmarks[0].landmark

        # Head tilt: nose tip vs eye center vs chin
        nose_tip_y = lm[1].y
        eye_center_y = (lm[159].y + lm[386].y) / 2
        chin_y = lm[152].y
        nose_ratio = (nose_tip_y - eye_center_y) / max(chin_y - eye_center_y, 0.001)
        head_down = nose_ratio > 0.55

        # Gaze: left iris position relative to eyelids (landmark 468 = left iris)
        left_iris_y = lm[468].y
        left_top_lid = lm[159].y
        left_bot_lid = lm[145].y
        iris_ratio = (left_iris_y - left_top_lid) / max(left_bot_lid - left_top_lid, 0.001)
        eyes_down = iris_ratio > 0.6

        reading = head_down or eyes_down
        confidence = round(min(nose_ratio + (0.2 if eyes_down else 0.0), 1.0), 2)
        return reading, confidence

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

        # Detect reading from frame (non-blocking via thread pool)
        future = _cv_executor.submit(detect_reading_from_frame, frame)
        is_reading, confidence = future.result(timeout=5)

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

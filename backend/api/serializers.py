from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Book, Note, ReadingSession


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email')


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ('username', 'email', 'password')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )
        return user


class BookSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    is_public = serializers.BooleanField(read_only=True)
    last_page = serializers.IntegerField(read_only=True)
    class Meta:
        model = Book
        fields = ('id', 'user', 'title', 'author', 'pdf_file', 'uploaded_at', 'total_pages', 'last_page', 'is_public')
        read_only_fields = ('uploaded_at', 'user', 'last_page', 'is_public')

    def validate_pdf_file(self, file):
        if not file:
            raise serializers.ValidationError("File is required")
        if getattr(file, "size", 0) <= 0:
            raise serializers.ValidationError("File is empty")
        return file


class BookDetailSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    is_public = serializers.BooleanField(read_only=True)
    last_page = serializers.IntegerField(read_only=True)
    class Meta:
        model = Book
        fields = ('id', 'user', 'title', 'author', 'pdf_file', 'minio_path', 'uploaded_at', 'total_pages', 'last_page', 'is_public')
        read_only_fields = ('user', 'uploaded_at', 'last_page', 'is_public')


class NoteSerializer(serializers.ModelSerializer):
    book_title = serializers.CharField(source='book.title', read_only=True)

    class Meta:
        model = Note
        fields = ('id', 'book', 'book_title', 'content', 'page_number', 'created_at', 'updated_at')
        read_only_fields = ('user', 'created_at', 'updated_at')


class ReadingSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReadingSession
        fields = ('id', 'book', 'started_at', 'ended_at', 'total_seconds', 'is_active')
        read_only_fields = ('user', 'started_at')


class ReadingStatsSerializer(serializers.Serializer):
    total_seconds = serializers.IntegerField()
    streak_days = serializers.IntegerField()
    avg_per_day = serializers.FloatField()
    sessions_count = serializers.IntegerField()


class ReadingPingRequestSerializer(serializers.Serializer):
    frame = serializers.CharField(required=True)
    session_id = serializers.IntegerField(required=False, allow_null=True)


class ReadingPingResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    reading = serializers.BooleanField()
    confidence = serializers.FloatField()
    session_id = serializers.IntegerField()
    total_seconds = serializers.IntegerField()


class ReadingStopSerializer(serializers.Serializer):
    session_id = serializers.IntegerField(required=True)

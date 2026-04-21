import uuid

from django.db import models

from django.contrib.auth.models import User

import os




def book_upload_path(instance, filename):
    _, ext = os.path.splitext(filename or "")
    ext = (ext or ".pdf").lower()
    if instance.user_id:
        return f"books/{instance.user_id}/{uuid.uuid4()}{ext}"
    return f"books/admin/{uuid.uuid4()}{ext}"





class Book(models.Model):

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='books', null=True, blank=True)

    title = models.CharField(max_length=255)

    author = models.CharField(max_length=255, blank=True)

    pdf_file = models.FileField(upload_to=book_upload_path)

    minio_path = models.CharField(max_length=500, blank=True)

    uploaded_at = models.DateTimeField(auto_now_add=True)

    total_pages = models.IntegerField(default=0)

    last_page = models.PositiveIntegerField(default=0)

    is_public = models.BooleanField(default=False)


    class Meta:

        ordering = ['-uploaded_at']



    def __str__(self):

        return self.title





class Note(models.Model):

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notes')

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='notes')

    content = models.TextField()

    page_number = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)



    class Meta:

        ordering = ['-created_at']



    def __str__(self):

        return f"Note on {self.book.title} (page {self.page_number})"





class AdminBook(models.Model):

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='admin_books', null=True, blank=True)

    title = models.CharField(max_length=255)

    author = models.CharField(max_length=255, blank=True)

    pdf_file = models.FileField(upload_to='admin_books/')

    minio_path = models.CharField(max_length=500, blank=True)

    uploaded_at = models.DateTimeField(auto_now_add=True)

    total_pages = models.IntegerField(default=0)

    is_active = models.BooleanField(default=True)



    class Meta:

        ordering = ['-uploaded_at']



    def __str__(self):

        return self.title



class ReadingSession(models.Model):

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reading_sessions')

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='reading_sessions', null=True, blank=True)

    admin_book = models.ForeignKey(AdminBook, on_delete=models.CASCADE, related_name='reading_sessions', null=True, blank=True)

    started_at = models.DateTimeField(auto_now_add=True)

    ended_at = models.DateTimeField(null=True, blank=True)

    total_seconds = models.IntegerField(default=0)

    is_active = models.BooleanField(default=True)



    class Meta:

        ordering = ['-started_at']



    def __str__(self):

        return f"Session {self.id} for {self.user.username}"


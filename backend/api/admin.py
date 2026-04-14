from django.contrib import admin
from .models import Book, Note, ReadingSession

admin.site.register(Book)
admin.site.register(Note)
admin.site.register(ReadingSession)

from django.contrib import admin
from .models import Book, Note, ReadingSession, UserNotificationSettings

admin.site.register(Book)
admin.site.register(Note)
admin.site.register(ReadingSession)
admin.site.register(UserNotificationSettings)

from django.contrib import admin
from .models import Book, Note, ReadingSession, UserNotificationSettings, UserProfile

admin.site.register(Book)
admin.site.register(Note)
admin.site.register(ReadingSession)
admin.site.register(UserNotificationSettings)
admin.site.register(UserProfile)

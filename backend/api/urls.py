from django.urls import path
from . import views

urlpatterns = [
    # Auth
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/refresh/', views.RefreshTokenView.as_view(), name='token_refresh'),

    # Books
    path('books/', views.BookListCreateView.as_view(), name='book-list-create'),
    path('books/<int:pk>/', views.BookDetailDeleteView.as_view(), name='book-detail-delete'),
    path('books/<int:pk>/stream/', views.BookStreamView.as_view(), name='book-stream'),

    # Notes
    path('notes/', views.NoteListCreateView.as_view(), name='note-list-create'),
    path('notes/<int:pk>/', views.NoteDetailUpdateDeleteView.as_view(), name='note-detail-update-delete'),

    # Reading
    path('reading/ping/', views.ReadingPingView.as_view(), name='reading-ping'),
    path('reading/stop/', views.ReadingStopView.as_view(), name='reading-stop'),
    path('reading/stats/', views.ReadingStatsView.as_view(), name='reading-stats'),
]

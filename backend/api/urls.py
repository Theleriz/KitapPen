from django.urls import path
from . import views

urlpatterns = [
    # Auth
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/refresh/', views.RefreshTokenView.as_view(), name='token_refresh'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    path('auth/me/', views.UserProfileView.as_view(), name='user-profile'),

    # Books
    path('books/', views.BookListCreateView.as_view(), name='book-list-create'),
    path('books/public/', views.PublicBooksView.as_view(), name='public-books'),
    path('books/my/', views.MyBooksView.as_view(), name='my-books'),
    path('books/public/<int:pk>/add/', views.AddPublicBookToMyLibraryView.as_view(), name='public-book-add-to-my'),
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

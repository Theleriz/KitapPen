import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, TimeoutError } from 'rxjs';
import { catchError, finalize, timeout } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { ReadingService } from '../services/reading.service';

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  private authService = inject(AuthService);
  private readingService = inject(ReadingService);

  profile = {
    name: '',
    email: '',
    bio: '',
    favoriteGenre: 'Fiction',
    joinedDate: '',
  };

  stats = {
    booksRead: 0,
    hoursTracked: 0,
    currentStreak: 0,
  };

  loading = false;
  saveLoading = false;
  error = '';
  saveSuccess = false;
  saveError = '';

  ngOnInit(): void {
    this.loading = true;
    forkJoin({
      user: this.authService.getUserProfile(),
      stats: this.readingService.getStats().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ user, stats }) => {
        this.profile.name = user.username;
        this.profile.email = user.email;
        this.profile.joinedDate = new Date(user.date_joined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (stats) {
          this.stats.hoursTracked = Math.floor(stats.total_seconds / 3600);
          this.stats.currentStreak = stats.streak_days;
          this.stats.booksRead = stats.sessions_count;
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load profile data.';
        this.loading = false;
      }
    });
  }

  saveProfile(): void {
    this.saveLoading = true;
    this.saveSuccess = false;
    this.saveError = '';
    this.authService.updateUserProfile({ username: this.profile.name, email: this.profile.email })
      .pipe(
        timeout(10000),
        finalize(() => (this.saveLoading = false)),
      )
      .subscribe({
        next: (updatedUser) => {
          this.profile.name = updatedUser.username;
          this.profile.email = updatedUser.email;
          this.saveSuccess = true;
          setTimeout(() => (this.saveSuccess = false), 3000);
        },
        error: (err) => {
          this.saveError = err instanceof TimeoutError
            ? 'Request timed out. Please try again.'
            : 'Failed to save changes.';
        },
      });
  }
}

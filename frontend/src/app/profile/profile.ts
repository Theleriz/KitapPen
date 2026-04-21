import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  private authService = inject(AuthService);

  profile = {
    name: this.authService.currentUser()?.name || 'Emma Carter',
    email: this.authService.currentUser()?.email || 'emma.carter@example.com',
    bio: 'Passionate reader who enjoys fiction, classics, and productivity books.',
    favoriteGenre: 'Fiction',
    joinedDate: 'March 2026',
  };

  stats = {
    booksRead: 24,
    hoursTracked: 58,
    currentStreak: 12,
  };

  saveProfile(): void {
    console.log('Profile saved', this.profile);
  }
}

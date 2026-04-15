import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  profile = {
    name: 'Emma Carter',
    email: 'emma.carter@example.com',
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

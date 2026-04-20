import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  private authService = inject(AuthService);
  private router = inject(Router);

  settings = {
    darkMode: false,
    emailNotifications: true,
    readingReminders: true,
    autoplayTracking: false,
    language: 'English',
    dailyGoal: 30,
    timezone: 'Asia/Almaty',
    weekStartsOn: 'Monday',
  };

  saveSettings(): void {
    localStorage.setItem('booktracker_settings', JSON.stringify(this.settings));
    console.log('Settings saved', this.settings);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

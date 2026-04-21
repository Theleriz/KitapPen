import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  settings = {
    darkMode: false,
    emailNotifications: true,
    readingReminders: true,
    autoplayTracking: false,
    language: 'English',
    dailyGoal: 30,
  };

  saveSettings(): void {
    console.log('Settings saved', this.settings);
  }
}

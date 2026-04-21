import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

const STORAGE_KEY = 'app-settings';

const DEFAULT_SETTINGS = {
  darkMode: false,
  emailNotifications: true,
  readingReminders: true,
  autoplayTracking: false,
  language: 'English',
  dailyGoal: 30,
};

@Component({
  selector: 'app-settings',
  imports: [FormsModule, CommonModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings implements OnInit {
  settings = { ...DEFAULT_SETTINGS };
  saved = false;

  ngOnInit(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch {
        // ignore malformed data
      }
    }
  }

  saveSettings(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    this.saved = true;
    setTimeout(() => (this.saved = false), 2500);
  }

  resetSettings(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    localStorage.removeItem(STORAGE_KEY);
  }
}

import { Injectable, signal } from '@angular/core';

export interface AuthUser {
  name: string;
  email: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly storageKey = 'booktracker_user';

  currentUser = signal<AuthUser | null>(this.getUserFromStorage());

  private getUserFromStorage(): AuthUser | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  signIn(email: string, password: string): boolean {
    if (!email.trim() || !password.trim()) return false;

    const user: AuthUser = {
      name: email.split('@')[0] || 'Reader',
      email: email.trim(),
    };

    localStorage.setItem(this.storageKey, JSON.stringify(user));
    this.currentUser.set(user);
    return true;
  }

  signUp(name: string, email: string, password: string): boolean {
    if (!name.trim() || !email.trim() || !password.trim()) return false;

    const user: AuthUser = {
      name: name.trim(),
      email: email.trim(),
    };

    localStorage.setItem(this.storageKey, JSON.stringify(user));
    this.currentUser.set(user);
    return true;
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
    this.currentUser.set(null);
  }
}

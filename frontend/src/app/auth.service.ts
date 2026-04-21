import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient) {}

  // LOGIN
  signIn(username: string, password: string) {
    return this.http.post<any>(`${this.apiUrl}/auth/login/`, {
      username,
      password,
    });
  }

  // REGISTER
  signUp(username: string, email: string, password: string) {
    return this.http.post<any>(`${this.apiUrl}/auth/register/`, {
      username,
      email,
      password,
    });
  }

  // SAVE TOKENS
  saveTokens(tokens: any) {
    localStorage.setItem('access', tokens.access);
    if (tokens.refresh) {
      localStorage.setItem('refresh', tokens.refresh);
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access');
  }

  logout(): void {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}

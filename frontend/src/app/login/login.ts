import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private authService = inject(AuthService);
  private router = inject(Router);

  mode: 'signin' | 'signup' = 'signin';

  signInForm = {
    username: '',
    password: '',
  };

  signUpForm = {
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  };

  errorMessage = '';

  private setApiError(err: any, fallback: string): void {
    const data = err?.error;
    if (typeof data === 'string' && data.trim()) {
      this.errorMessage = data;
      return;
    }
    if (data && typeof data === 'object') {
      const messages: string[] = [];
      for (const [field, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
          for (const v of value) messages.push(`${field}: ${v}`);
        } else if (typeof value === 'string') {
          messages.push(`${field}: ${value}`);
        }
      }
      if (messages.length) {
        this.errorMessage = messages.join('\n');
        return;
      }
    }
    this.errorMessage = fallback;
  }

  setMode(mode: 'signin' | 'signup'): void {
    this.mode = mode;
    this.errorMessage = '';
  }

  submitSignIn(): void {
    this.errorMessage = '';
    this.authService
      .signIn(this.signInForm.username, this.signInForm.password)
      .subscribe({
        next: (res) => {
          this.authService.saveTokens(res);
          this.router.navigate(['/library']);
        },
        error: (err) => {
          this.setApiError(err, 'Invalid username or password');
        },
      });
  }

  submitSignUp(): void {
    this.errorMessage = '';

    if (this.signUpForm.password !== this.signUpForm.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    this.authService
      .signUp(
        this.signUpForm.username,
        this.signUpForm.email,
        this.signUpForm.password
      )
      .subscribe({
        next: (res) => {
          // Backend returns tokens on successful registration
          if (res?.access) {
            this.authService.saveTokens(res);
            this.router.navigate(['/library']);
            return;
          }
          // Fallback: allow user to sign in manually
          this.mode = 'signin';
        },
        error: (err) => {
          this.setApiError(err, 'Registration failed.');
        },
      });
  }
}

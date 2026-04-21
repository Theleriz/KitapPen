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
        error: () => {
          this.errorMessage = 'Invalid username or password';
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
        next: () => {
          this.mode = 'signin';
        },
        error: () => {
          this.errorMessage = 'Registration failed. Username may already exist.';
        },
      });
  }
}

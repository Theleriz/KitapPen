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
    email: '',
    password: '',
  };

  signUpForm = {
    name: '',
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

    const success = this.authService.signIn(
      this.signInForm.email,
      this.signInForm.password
    );

    if (!success) {
      this.errorMessage = 'Please enter email and password.';
      return;
    }

    this.router.navigate(['/library']);
  }

  submitSignUp(): void {
    this.errorMessage = '';

    if (this.signUpForm.password !== this.signUpForm.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    const success = this.authService.signUp(
      this.signUpForm.name,
      this.signUpForm.email,
      this.signUpForm.password
    );

    if (!success) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }

    this.router.navigate(['/library']);
  }
}

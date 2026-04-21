import { Component, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter, finalize } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private router = inject(Router);
  private authService = inject(AuthService);

  currentUrl = '';
  isModerator = false;
  private roleLoaded = false;

  constructor() {
    this.currentUrl = this.router.url;

    if (this.authService.isAuthenticated()) {
      this.loadUserRole();
    }

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentUrl = event.urlAfterRedirects;
        if (this.currentUrl === '/login') {
          this.isModerator = false;
          this.roleLoaded = false;
        } else if (!this.roleLoaded && this.authService.isAuthenticated()) {
          this.loadUserRole();
        }
      });
  }

  private loadUserRole(): void {
    this.authService.getUserProfile().subscribe({
      next: profile => {
        this.isModerator = profile.role === 'moderator';
        this.roleLoaded = true;
      },
      error: () => {
        this.isModerator = false;
        this.roleLoaded = false;
      },
    });
  }

  get showNavbar(): boolean {
    return this.currentUrl !== '/login';
  }

  logout(): void {
    this.authService.logoutFromServer().pipe(
      finalize(() => {
        this.authService.logout();
        this.isModerator = false;
        this.roleLoaded = false;
        this.router.navigate(['/login']);
      })
    ).subscribe({ error: () => {} });
  }
}

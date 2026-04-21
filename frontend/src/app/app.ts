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

  constructor() {
    this.currentUrl = this.router.url;

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentUrl = event.urlAfterRedirects;
      });
  }

  get showNavbar(): boolean {
    return this.currentUrl !== '/login';
  }

  logout(): void {
    this.authService.logoutFromServer().pipe(
      finalize(() => {
        this.authService.logout();
        this.router.navigate(['/login']);
      })
    ).subscribe({ error: () => {} });
  }
}

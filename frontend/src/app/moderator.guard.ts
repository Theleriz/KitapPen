import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export const moderatorGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  return authService.getUserProfile().pipe(
    map(profile => {
      if (profile.role === 'moderator') return true;
      return router.createUrlTree(['/library']);
    }),
    catchError(() => of(router.createUrlTree(['/library'])))
  );
};

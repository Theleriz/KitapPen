import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth.service';

const AUTH_ENDPOINTS = ['/auth/login/', '/auth/register/', '/auth/refresh/'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isAuthEndpoint = AUTH_ENDPOINTS.some(endpoint => req.url.includes(endpoint));
  const token = localStorage.getItem('access');

  const authReq = token && !isAuthEndpoint
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint) {
        const refresh = localStorage.getItem('refresh');
        if (refresh) {
          return authService.refreshToken().pipe(
            switchMap((tokens) => {
              authService.saveTokens(tokens);
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${tokens.access}` },
              });
              return next(retryReq);
            }),
            catchError((refreshError) => {
              authService.logout();
              router.navigate(['/login']);
              return throwError(() => refreshError);
            }),
          );
        }
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};

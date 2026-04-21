import { Routes } from '@angular/router';
import { Libary } from './libary/libary';
import { YourLibary } from './your-libary/your-libary';
import { Tracker } from './tracker/tracker';
import { Statistics } from './statistics/statistics';
import { Profile } from './profile/profile';
import { Settings } from './settings/settings';
import { Login } from './login/login';
import { Reader } from './reader/reader';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },

  { path: 'library', component: Libary, canActivate: [authGuard] },
  { path: 'my-library', component: YourLibary, canActivate: [authGuard] },
  { path: 'reader/:id', component: Reader, canActivate: [authGuard] },
  { path: 'tracker', component: Tracker, canActivate: [authGuard] },
  { path: 'statistics', component: Statistics, canActivate: [authGuard] },
  { path: 'profile', component: Profile, canActivate: [authGuard] },
  { path: 'settings', component: Settings, canActivate: [authGuard] },

  { path: '**', redirectTo: 'login' },
];

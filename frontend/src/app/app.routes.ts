import { Routes } from '@angular/router';
import { Libary } from './libary/libary';
import { YourLibary } from './your-libary/your-libary';
import { Tracker } from './tracker/tracker';
import { Statistics } from './statistics/statistics';
import { Profile } from './profile/profile';
import { Settings } from './settings/settings';

export const routes: Routes = [
  { path: '',            redirectTo: 'library', pathMatch: 'full' },
  { path: 'library',    component: Libary },
  { path: 'my-library', component: YourLibary },
  { path: 'tracker',    component: Tracker },
  { path: 'statistics', component: Statistics },
  { path: 'profile', component: Profile },
  { path: 'settings', component: Settings },
];

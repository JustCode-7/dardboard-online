import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home-page').then(m => m.HomePage),
  },
  {
    path: 'game/:lobbyId',
    canActivate: [authGuard],
    loadComponent: () => import('./features/game/game-page').then(m => m.GamePage),
  },
  { path: '**', redirectTo: '' },
];

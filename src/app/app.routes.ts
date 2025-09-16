import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./presentation/menu/menu.page').then(m => m.MenuPage) },
  { path: 'play', loadComponent: () => import('./presentation/play/play.page').then(m => m.PlayPage) },
  { path: 'ranking', loadComponent: () => import('./presentation/ranking/ranking.page').then(m => m.RankingPage) },
  { path: 'alias/:alias', loadComponent: () => import('./presentation/alias/alias.page').then(m => m.AliasPage) },
  { path: '**', redirectTo: '' }
];

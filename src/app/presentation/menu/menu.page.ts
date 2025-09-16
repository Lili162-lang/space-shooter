import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-menu',
  standalone: true,
  templateUrl: './menu.page.html',
  styleUrl: './menu.page.css'
})
export class MenuPage {
  difficulty = signal<'easy' | 'normal' | 'hard'>('easy');
  constructor(private router: Router) {}

  play() {
    this.router.navigateByUrl('/play', { state: { difficulty: this.difficulty() } });
  }
}

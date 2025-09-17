import { Component, OnInit, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ScoreHttpService } from '../../infrastructure/score/score.http';
import { ScoreTopItem } from '../../domain/score/score.models';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './menu.page.html',
  styleUrl: './menu.page.css',
})
export class MenuPage implements OnInit {
  difficulty = signal<'easy' | 'normal' | 'hard'>('easy');

  private api = inject(ScoreHttpService);
  top = signal<ScoreTopItem[] | null>(null);
  limit = signal(10);

  constructor(private router: Router) {}

  ngOnInit() {
    this.loadTop();
  }

  loadTop() {
    this.api.getTop(this.limit()).subscribe((rows) => this.top.set(rows));
  }

  applyLimit(v: string | number) {
    const n = Math.max(1, Math.min(100, Number(v) || 10)); // 1..100
    if (n === this.limit()) return;
    this.limit.set(n);
    this.loadTop();
  }

  play() {
    this.router.navigateByUrl('/play', {
      state: { difficulty: this.difficulty() },
    });
  }
}

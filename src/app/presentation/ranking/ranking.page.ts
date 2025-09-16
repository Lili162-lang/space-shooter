import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ScoreHttpService } from '../../infrastructure/score/score.http';
import { ScoreTopItem } from '../../domain/score/score.models';

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './ranking.page.html',
  styleUrl: './ranking.page.css'
})
export class RankingPage implements OnInit {
  private readonly api = inject(ScoreHttpService);
  private readonly router = inject(Router);

  top = signal<ScoreTopItem[] | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit() { this.loadTop(); }

  loadTop() {
    this.loading.set(true);
    this.error.set(null);
    this.api.getTop(10).subscribe({
      next: rows => { this.top.set(rows); this.loading.set(false); },
      error: _ => { this.error.set('No se pudo cargar el ranking.'); this.loading.set(false); }
    });
  }

  onSearch(v: string) {
    const q = v.trim();
    if (!q) return;
    this.router.navigate(['/alias', q]);
  }
}

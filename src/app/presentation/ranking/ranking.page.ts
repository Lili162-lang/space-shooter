import { Component, OnInit, signal, inject } from '@angular/core';
import { ScoreHttpService } from '../../infrastructure/score/score.http';
import { ScoreTopItem } from '../../domain/score/score.models';
import { AsyncPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink],
  templateUrl: './ranking.page.html',
  styleUrl: './ranking.page.css'
})
export class RankingPage implements OnInit {
  private readonly api = inject(ScoreHttpService);
  private readonly router = inject(Router);
  top = signal<ScoreTopItem[] | null>(null);

  ngOnInit() { this.api.getTop(10).subscribe(v => this.top.set(v)); }

  onSearch(v: string) {
    const q = v.trim();
    if (!q) return;                // evita navegar vacío
    this.router.navigate(['/alias', q]);
  }
}

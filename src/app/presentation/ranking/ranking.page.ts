import { Component, OnInit, signal, inject } from '@angular/core';
import { ScoreHttpService } from '../../infrastructure/score/score.http';
import { ScoreTopItem } from '../../domain/score/score.models';
import { AsyncPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink],
  templateUrl: './ranking.page.html',
  styleUrl: './ranking.page.css'
})
export class RankingPage implements OnInit {
  private readonly api = inject(ScoreHttpService);
  top = signal<ScoreTopItem[] | null>(null);
  ngOnInit() { this.api.getTop(10).subscribe(v => this.top.set(v)); }
}

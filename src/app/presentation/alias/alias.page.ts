import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ScoreHttpService } from '../../infrastructure/score/score.http';
import { DatePipe, NgIf, NgFor } from '@angular/common';
import { switchMap, map, distinctUntilChanged } from 'rxjs/operators';
import { Router } from '@angular/router';

@Component({
  selector: 'app-alias-history',
  standalone: true,
  imports: [RouterLink, DatePipe, NgIf, NgFor],
  templateUrl: './alias.page.html',
  styleUrl: './alias.page.css'
})
export class AliasPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ScoreHttpService);
  private readonly router = inject(Router);
  alias = signal<string>('');
  rows  = signal<any[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor() {
    this.route.paramMap
      .pipe(
        map(p => (p.get('alias') ?? '').trim()),
        distinctUntilChanged(),
        switchMap(a => {
          this.alias.set(a);
          this.error.set(null);
          this.rows.set([]);
          if (!a) return [];
          this.loading.set(true);
          return this.api.getByAlias(a);
        })
      )
      .subscribe({
        next: r => { this.rows.set(r as any[]); this.loading.set(false); },
        error: _ => { this.error.set('No se pudo cargar el historial.'); this.loading.set(false); }
      });
  }
  goBack() {
    if (history.length > 1) history.back();
    else this.router.navigate(['/ranking']);
  }
}

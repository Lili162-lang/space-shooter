import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ScoreHttpService } from '../../infrastructure/score/score.http';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-alias-history',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './alias.page.html',
  styleUrl: './alias.page.css'
})
export class AliasPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ScoreHttpService);
  alias = signal<string>('');
  rows = signal<any[]>([]);

  ngOnInit(): void {
    const a = this.route.snapshot.paramMap.get('alias') ?? '';
    this.alias.set(a);
    this.api.getByAlias(a).subscribe(r => this.rows.set(r));
  }
}

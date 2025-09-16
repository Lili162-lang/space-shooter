import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BASE_API_URL } from '../../core/config/env';
import { ScorePostBody, ScoreCreated, ScoreTopItem, ScoreByAliasItem } from '../../domain/score/score.models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ScoreHttpService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(BASE_API_URL);

  postScore(body: ScorePostBody): Observable<ScoreCreated> {
    return this.http.post<ScoreCreated>(`${this.base}/api/v1/scores`, body);
  }

  getTop(limit = 10): Observable<ScoreTopItem[]> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http.get<ScoreTopItem[]>(`${this.base}/api/v1/scores/top`, { params });
  }

  getByAlias(alias: string): Observable<ScoreByAliasItem[]> {
    return this.http.get<ScoreByAliasItem[]>(`${this.base}/api/v1/scores/alias/${encodeURIComponent(alias)}`);
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ReadingStats {
  total_seconds: number;
  streak_days: number;
  avg_per_day: number;
  sessions_count: number;
}

@Injectable({ providedIn: 'root' })
export class ReadingService {
  private apiUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  getStats(): Observable<ReadingStats> {
    return this.http.get<ReadingStats>(`${this.apiUrl}/reading/stats/`);
  }
}

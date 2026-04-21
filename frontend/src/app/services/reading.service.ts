import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ReadingStats {
  total_seconds: number;
  streak_days: number;
  avg_per_day: number;
  sessions_count: number;
}

export interface PingResponse {
  ok: boolean;
  reading: boolean;
  confidence: number;
  session_id: number | null;
  total_seconds: number;
}

export interface StopResponse {
  ok: boolean;
  total_seconds: number;
}

export interface WeekStats {
  days: { date: string; total_seconds: number }[];
}

export interface SessionItem {
  id: number;
  started_at: string;
  ended_at: string | null;
  total_seconds: number;
  book_title: string | null;
}

export interface SessionsPage {
  results: SessionItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

@Injectable({ providedIn: 'root' })
export class ReadingService {
  private apiUrl = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient) {}

  getStats(): Observable<ReadingStats> {
    return this.http.get<ReadingStats>(`${this.apiUrl}/reading/stats/`);
  }

  ping(frame: string, sessionId: number | null = null, bookId: number | null = null): Observable<PingResponse> {
    return this.http.post<PingResponse>(`${this.apiUrl}/reading/ping/`, {
      frame,
      session_id: sessionId,
      book_id: bookId,
    });
  }

  getSessions(page = 1, pageSize = 5): Observable<SessionsPage> {
    return this.http.get<SessionsPage>(`${this.apiUrl}/reading/sessions/`, {
      params: { page: page.toString(), page_size: pageSize.toString() },
    });
  }

  getWeekStats(): Observable<WeekStats> {
    return this.http.get<WeekStats>(`${this.apiUrl}/reading/week/`);
  }

  stop(sessionId: number): Observable<StopResponse> {
    return this.http.post<StopResponse>(`${this.apiUrl}/reading/stop/`, {
      session_id: sessionId
    });
  }
}

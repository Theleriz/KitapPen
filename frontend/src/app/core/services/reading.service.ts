import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PingResponse, ReadingStats } from '../models/reading-session.model';

@Injectable({
  providedIn: 'root',
})
export class ReadingService {
  private readonly base = '/api/reading';

  constructor(private http: HttpClient) {}

  ping(frameBase64: string, sessionId: number | null): Observable<PingResponse> {
    return this.http.post<PingResponse>(`${this.base}/ping/`, {
      frame: frameBase64,
      session_id: sessionId,
    });
  }

  stopSession(sessionId: number): Observable<{ ok: boolean; total_seconds: number }> {
    return this.http.post<{ ok: boolean; total_seconds: number }>(`${this.base}/stop/`, {
      session_id: sessionId,
    });
  }

  getStats(): Observable<ReadingStats> {
    return this.http.get<ReadingStats>(`${this.base}/stats/`);
  }
}

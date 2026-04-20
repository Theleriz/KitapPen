export interface PingResponse {
  ok: boolean;
  reading: boolean;
  confidence: number;
  session_id: number;
  total_seconds: number;
}

export interface ReadingSession {
  id: number;
  started_at: string;
  ended_at: string | null;
  total_seconds: number;
  is_active: boolean;
}

export interface ReadingStats {
  total_seconds: number;
  streak_days: number;
  avg_per_day: number;
  sessions_count: number;
}

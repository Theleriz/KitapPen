import { Component, OnInit, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ReadingService, ReadingStats, SessionItem, LeaderboardEntry } from '../services/reading.service';

interface WeekDay {
  label: string;
  heightPct: number;
  minutes: number;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PAGE_SIZE = 5;

@Component({
  selector: 'app-statistics',
  imports: [],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css',
})
export class Statistics implements OnInit {
  private readingService = inject(ReadingService);

  weekDays: WeekDay[] = DAY_LABELS.map((label) => ({ label, heightPct: 0, minutes: 0 }));

  stats: ReadingStats | null = null;
  loading = false;
  error = '';

  sessions: SessionItem[] = [];
  sessionsPage = 1;
  sessionsTotalPages = 1;
  sessionsLoading = false;

  timeLeaders: LeaderboardEntry[] = [];
  streakLeaders: LeaderboardEntry[] = [];
  leaderboardTab: 'time' | 'streak' = 'time';
  leaderboardLoading = false;

  ngOnInit(): void {
    this.loading = true;
    forkJoin({
      stats: this.readingService.getStats(),
      week: this.readingService.getWeekStats(),
    }).subscribe({
      next: ({ stats, week }) => {
        this.stats = stats;
        const max = Math.max(...week.days.map((d) => d.total_seconds), 1);
        this.weekDays = week.days.map((d, i) => ({
          label: DAY_LABELS[i],
          heightPct: Math.round((d.total_seconds / max) * 100),
          minutes: Math.round(d.total_seconds / 60),
        }));
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load statistics.';
        this.loading = false;
      },
    });
    this.loadSessions(1);
    this.loadLeaderboard();
  }

  loadLeaderboard(): void {
    this.leaderboardLoading = true;
    this.readingService.getLeaderboard().subscribe({
      next: (data) => {
        this.timeLeaders = data.time_leaders;
        this.streakLeaders = data.streak_leaders;
        this.leaderboardLoading = false;
      },
      error: () => (this.leaderboardLoading = false),
    });
  }

  get activeLeaders(): LeaderboardEntry[] {
    return this.leaderboardTab === 'time' ? this.timeLeaders : this.streakLeaders;
  }

  loadSessions(page: number): void {
    this.sessionsLoading = true;
    this.readingService.getSessions(page, PAGE_SIZE).subscribe({
      next: (data) => {
        this.sessions = data.results;
        this.sessionsPage = data.page;
        this.sessionsTotalPages = data.total_pages;
        this.sessionsLoading = false;
      },
      error: () => (this.sessionsLoading = false),
    });
  }

  prevPage(): void {
    if (this.sessionsPage > 1) this.loadSessions(this.sessionsPage - 1);
  }

  nextPage(): void {
    if (this.sessionsPage < this.sessionsTotalPages) this.loadSessions(this.sessionsPage + 1);
  }

  formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  get totalHours(): string {
    if (!this.stats) return '—';
    const h = Math.floor(this.stats.total_seconds / 3600);
    const m = Math.floor((this.stats.total_seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  get avgMinutes(): string {
    if (!this.stats) return '—';
    return Math.round(this.stats.avg_per_day / 60).toString();
  }
}

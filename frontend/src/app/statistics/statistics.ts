import { Component, OnInit, inject } from '@angular/core';
import { ReadingService, ReadingStats } from '../services/reading.service';

interface WeekDay {
  label: string;
  heightPct: number;
}

@Component({
  selector: 'app-statistics',
  imports: [],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css',
})
export class Statistics implements OnInit {
  private readingService = inject(ReadingService);

  weekDays: WeekDay[] = [
    { label: 'Mon', heightPct: 0 },
    { label: 'Tue', heightPct: 0 },
    { label: 'Wed', heightPct: 0 },
    { label: 'Thu', heightPct: 0 },
    { label: 'Fri', heightPct: 0 },
    { label: 'Sat', heightPct: 0 },
    { label: 'Sun', heightPct: 0 },
  ];

  stats: ReadingStats | null = null;
  loading = false;
  error = '';

  ngOnInit(): void {
    this.loading = true;
    this.readingService.getStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load statistics.';
        this.loading = false;
      }
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

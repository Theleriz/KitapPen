import { Component } from '@angular/core';

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
export class Statistics {
  weekDays: WeekDay[] = [
    { label: 'Mon', heightPct: 0 },
    { label: 'Tue', heightPct: 0 },
    { label: 'Wed', heightPct: 0 },
    { label: 'Thu', heightPct: 0 },
    { label: 'Fri', heightPct: 0 },
    { label: 'Sat', heightPct: 0 },
    { label: 'Sun', heightPct: 0 },
  ];
}

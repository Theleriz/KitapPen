import { Component, ElementRef, ViewChild, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-tracker',
  imports: [],
  templateUrl: './tracker.html',
  styleUrl: './tracker.css',
})
export class Tracker implements OnDestroy {
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;

  isTracking = false;
  isReading = false;
  confidence = 0;

  private sessionSeconds = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  get formattedTime(): string {
    const h = Math.floor(this.sessionSeconds / 3600);
    const m = Math.floor((this.sessionSeconds % 3600) / 60);
    const s = this.sessionSeconds % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  startSession(): void {
    this.isTracking = true;
    this.sessionSeconds = 0;
    this.timerInterval = setInterval(() => this.sessionSeconds++, 1000);
    // TODO: getUserMedia + ping loop
  }

  stopSession(): void {
    this.isTracking = false;
    this.isReading = false;
    this.confidence = 0;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    // TODO: POST /api/reading/stop/
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }
}

import { Component, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { ReadingService } from '../core/services/reading.service';

@Component({
  selector: 'app-tracker',
  imports: [],
  templateUrl: './tracker.html',
  styleUrl: './tracker.css',
})
export class Tracker implements OnDestroy {
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  isTracking = false;
  isReading = false;
  confidence = 0;
  sessionId: number | null = null;
  sessionSeconds = 0;

  private stream: MediaStream | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readingService: ReadingService) {}

  get formattedTime(): string {
    const h = Math.floor(this.sessionSeconds / 3600);
    const m = Math.floor((this.sessionSeconds % 3600) / 60);
    const s = this.sessionSeconds % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  async startSession(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.videoEl.nativeElement.srcObject = this.stream;
    } catch {
      console.error('Camera access denied');
      return;
    }

    this.isTracking = true;
    this.sessionSeconds = 0;
    this.sessionId = null;

    this.timerInterval = setInterval(() => this.sessionSeconds++, 1000);

    this.pingInterval = setInterval(() => {
      const frame = this.captureFrame();
      this.readingService.ping(frame, this.sessionId).subscribe({
        next: (res) => {
          this.isReading = res.reading;
          this.confidence = res.confidence;
          this.sessionId = res.session_id;
        },
        error: (err) => console.error('Ping error', err),
      });
    }, 1_000); //time interval for canvas utill
  }

  stopSession(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.sessionId !== null) {
      this.readingService.stopSession(this.sessionId).subscribe({
        error: (err) => console.error('Stop session error', err),
      });
    }

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    this.isTracking = false;
    this.isReading = false;
    this.confidence = 0;
    this.sessionId = null;
    this.sessionSeconds = 0;
  }

  private captureFrame(): string {
    const canvas = this.canvasEl.nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(this.videoEl.nativeElement, 0, 0, 320, 240);
    return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
  }

  ngOnDestroy(): void {
    this.stopSession();
  }
}

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ReadingService } from './reading.service';

const SETTINGS_KEY = 'app-settings';

@Injectable({ providedIn: 'root' })
export class TrackingSessionService implements OnDestroy {
  private _isTracking = new BehaviorSubject(false);
  private _isReading = new BehaviorSubject(false);
  private _confidence = new BehaviorSubject(0);
  private _sessionSeconds = new BehaviorSubject(0);

  readonly isTracking$ = this._isTracking.asObservable();
  readonly isReading$ = this._isReading.asObservable();
  readonly confidence$ = this._confidence.asObservable();
  readonly sessionSeconds$ = this._sessionSeconds.asObservable();

  get isTracking(): boolean { return this._isTracking.value; }
  get stream(): MediaStream | null { return this._stream; }

  private _stream: MediaStream | null = null;
  private captureVideo: HTMLVideoElement | null = null;
  private sessionId: number | null = null;
  private bookId: number | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readingService: ReadingService) {}

  get autostart(): boolean {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) return !!(JSON.parse(stored).autoplayTracking);
    } catch {}
    return false;
  }

  setAutostart(value: boolean): void {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      const settings = stored ? JSON.parse(stored) : {};
      settings.autoplayTracking = value;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }

  async start(bookId: number | null = null): Promise<boolean> {
    if (this.isTracking) return true;
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.captureVideo = document.createElement('video');
      this.captureVideo.srcObject = this._stream;
      this.captureVideo.autoplay = true;
      this.captureVideo.muted = true;
      this.captureVideo.playsInline = true;
      await this.captureVideo.play().catch(() => {});
    } catch {
      return false;
    }

    this.bookId = bookId;
    this.sessionId = null;
    this._sessionSeconds.next(0);
    this._isTracking.next(true);

    this.timerInterval = setInterval(() => {
      this._sessionSeconds.next(this._sessionSeconds.value + 1);
    }, 1000);
    this.pingInterval = setInterval(() => this.sendPing(), 2000);
    return true;
  }

  stop(): void {
    if (!this.isTracking) return;

    this._isTracking.next(false);
    this._isReading.next(false);
    this._confidence.next(0);

    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }

    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    if (this.captureVideo) {
      this.captureVideo.srcObject = null;
      this.captureVideo = null;
    }

    if (this.sessionId !== null) {
      this.readingService.stop(this.sessionId).subscribe({
        error: e => console.error('Stop session error', e),
      });
      this.sessionId = null;
    }
    this.bookId = null;
  }

  private sendPing(): void {
    const video = this.captureVideo;
    if (!video || video.readyState < 2) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const frame = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

    this.readingService.ping(frame, this.sessionId, this.bookId).subscribe({
      next: res => {
        this._isReading.next(res.reading);
        this._confidence.next(res.confidence);
        if (res.session_id !== null) this.sessionId = res.session_id;
      },
      error: e => console.error('Ping error', e),
    });
  }

  ngOnDestroy(): void {
    this.stop();
  }
}

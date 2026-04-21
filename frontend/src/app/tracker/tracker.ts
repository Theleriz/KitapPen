import { Component, ElementRef, ViewChild, OnInit, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TrackingSessionService } from '../services/tracking-session.service';
import { BookService, Book } from '../services/book.service';

@Component({
  selector: 'app-tracker',
  imports: [FormsModule],
  templateUrl: './tracker.html',
  styleUrl: './tracker.css',
})
export class Tracker implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;

  isTracking = false;
  isReading = false;
  confidence = 0;
  sessionSeconds = 0;
  books: Book[] = [];
  selectedBookId: number | null = null;

  private subs: Subscription[] = [];
  readonly trackingService = inject(TrackingSessionService);
  private bookService = inject(BookService);

  get autostart(): boolean { return this.trackingService.autostart; }
  set autostart(v: boolean) { this.trackingService.setAutostart(v); }

  get formattedTime(): string {
    const h = Math.floor(this.sessionSeconds / 3600);
    const m = Math.floor((this.sessionSeconds % 3600) / 60);
    const s = this.sessionSeconds % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  ngOnInit(): void {
    this.bookService.getMyBooks().subscribe({
      next: books => (this.books = books),
      error: e => console.error('Failed to load books', e),
    });

    this.subs.push(
      this.trackingService.isTracking$.subscribe(v => {
        this.isTracking = v;
        if (v && this.trackingService.stream && this.videoEl?.nativeElement) {
          this.videoEl.nativeElement.srcObject = this.trackingService.stream;
        }
      }),
      this.trackingService.isReading$.subscribe(v => (this.isReading = v)),
      this.trackingService.confidence$.subscribe(v => (this.confidence = v)),
      this.trackingService.sessionSeconds$.subscribe(v => (this.sessionSeconds = v)),
    );

    // If session already active (e.g. started from Reader), attach the stream
    if (this.isTracking && this.trackingService.stream && this.videoEl?.nativeElement) {
      this.videoEl.nativeElement.srcObject = this.trackingService.stream;
    }
  }

  async startSession(): Promise<void> {
    const ok = await this.trackingService.start(this.selectedBookId);
    if (ok && this.videoEl?.nativeElement && this.trackingService.stream) {
      this.videoEl.nativeElement.srcObject = this.trackingService.stream;
    }
  }

  stopSession(): void {
    this.trackingService.stop();
    if (this.videoEl?.nativeElement) {
      this.videoEl.nativeElement.srcObject = null;
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}

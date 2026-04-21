import { Component, ElementRef, ViewChild, OnInit, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReadingService } from '../services/reading.service';
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
  books: Book[] = [];
  selectedBookId: number | null = null;

  private sessionId: number | null = null;
  private sessionSeconds = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private stream: MediaStream | null = null;

  private readingService = inject(ReadingService);
  private bookService = inject(BookService);

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
      next: (books) => (this.books = books),
      error: (e) => console.error('Failed to load books', e),
    });
  }

  async startSession(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.videoEl.nativeElement.srcObject = this.stream;
    } catch (e) {
      console.error('Camera access denied', e);
      return;
    }

    this.isTracking = true;
    this.sessionSeconds = 0;
    this.sessionId = null;
    this.timerInterval = setInterval(() => this.sessionSeconds++, 1000);
    this.pingInterval = setInterval(() => this.sendPing(), 2000);
  }

  stopSession(): void {
    this.isTracking = false;
    this.isReading = false;
    this.confidence = 0;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    if (this.sessionId !== null) {
      this.readingService.stop(this.sessionId).subscribe({
        error: (e) => console.error('Stop session error', e),
      });
      this.sessionId = null;
    }
  }

  private sendPing(): void {
    const video = this.videoEl?.nativeElement;
    if (!video || video.readyState < 2) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const frame = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

    this.readingService.ping(frame, this.sessionId, this.selectedBookId).subscribe({
      next: (res) => {
        this.isReading = res.reading;
        this.confidence = res.confidence;
        if (res.session_id !== null) {
          this.sessionId = res.session_id;
        }
      },
      error: (e) => console.error('Ping error', e),
    });
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
  }
}

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Subject } from 'rxjs';
import { debounceTime, switchMap, takeUntil } from 'rxjs/operators';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { BookService, Book } from '../services/book.service';
import { TrackingSessionService } from '../services/tracking-session.service';

@Component({
  selector: 'app-reader',
  imports: [PdfViewerModule],
  templateUrl: './reader.html',
  styleUrl: './reader.css',
})
export class Reader implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookService = inject(BookService);
  private trackingService = inject(TrackingSessionService);

  bookId = 0;
  book: Book | null = null;
  pdfSrc: Uint8Array | null = null;
  currentPage = 1;
  totalPages = 0;
  loading = true;
  error = '';

  private destroy$ = new Subject<void>();
  private pageChange$ = new Subject<number>();
  private startedTracking = false;

  ngOnInit(): void {
    this.bookId = Number(this.route.snapshot.paramMap.get('id'));

    forkJoin({
      book: this.bookService.getBook(this.bookId),
      blob: this.bookService.getBookStream(this.bookId),
    }).subscribe({
      next: ({ book, blob }) => {
        this.book = book;
        const lastPage = book.last_page ?? 0;
        this.currentPage = lastPage > 0 ? lastPage : 1;

        if (lastPage === 0) {
          this.bookService.updateLastPage(this.bookId, 1).subscribe();
        }

        blob.arrayBuffer().then(buf => {
          this.pdfSrc = new Uint8Array(buf);
          this.loading = false;
        });

        // Autostart tracking for this book if enabled
        if (this.trackingService.autostart && !this.trackingService.isTracking) {
          this.trackingService.start(this.bookId).then(ok => {
            this.startedTracking = ok;
          });
        }
      },
      error: () => {
        this.error = 'Failed to load book.';
        this.loading = false;
      },
    });

    this.pageChange$
      .pipe(
        debounceTime(800),
        switchMap(page => this.bookService.updateLastPage(this.bookId, page)),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  onLoaded(pdf: { numPages: number }): void {
    this.totalPages = pdf.numPages;
    this.bookService.updateLastPage(this.bookId, this.currentPage, pdf.numPages).subscribe();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.pageChange$.next(page);
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.pageChange$.next(this.currentPage);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.pageChange$.next(this.currentPage);
    }
  }

  goBack(): void {
    this.bookService.updateLastPage(this.bookId, this.currentPage).subscribe();
    this.router.navigate(['/my-library']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.startedTracking) {
      this.trackingService.stop();
    }
  }
}

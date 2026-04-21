import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Subject } from 'rxjs';
import { debounceTime, switchMap, takeUntil } from 'rxjs/operators';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { BookService, Book } from '../services/book.service';

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

  bookId = 0;
  book: Book | null = null;
  pdfSrc: Uint8Array | null = null;
  currentPage = 1;
  totalPages = 0;
  loading = true;
  error = '';

  private destroy$ = new Subject<void>();
  private pageChange$ = new Subject<number>();

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

        // Immediately mark as started if this is the first open
        if (lastPage === 0) {
          this.bookService.updateLastPage(this.bookId, 1).subscribe();
        }

        blob.arrayBuffer().then(buf => {
          this.pdfSrc = new Uint8Array(buf);
          this.loading = false;
        });
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
    // Save total_pages to DB so progress bar works in My Library
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
    // Save immediately before navigating away (don't wait for debounce)
    this.bookService.updateLastPage(this.bookId, this.currentPage).subscribe();
    this.router.navigate(['/my-library']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

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

  book: Book | null = null;
  pdfSrc: Uint8Array | null = null;
  currentPage = 1;
  totalPages = 0;
  loading = true;
  error = '';

  private destroy$ = new Subject<void>();
  private pageChange$ = new Subject<number>();

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    forkJoin({
      book: this.bookService.getBook(id),
      blob: this.bookService.getBookStream(id),
    }).subscribe({
      next: ({ book, blob }) => {
        this.book = book;
        this.currentPage = book.last_page || 1;
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

    // Debounce page saves — send to server 1s after user stops turning pages
    this.pageChange$
      .pipe(
        debounceTime(1000),
        switchMap(page => this.bookService.updateLastPage(id, page)),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  onLoaded(pdf: { numPages: number }): void {
    this.totalPages = pdf.numPages;
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.pageChange$.next(page);
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  goBack(): void {
    this.router.navigate(['/my-library']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

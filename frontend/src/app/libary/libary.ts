import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BookService, Book } from '../services/book.service';

@Component({
  selector: 'app-libary',
  imports: [FormsModule],
  templateUrl: './libary.html',
  styleUrl: './libary.css',
})
export class Libary implements OnInit {
  private bookService = inject(BookService);

  searchQuery = '';
  currentPage = 1;
  readonly pageSize = 4;

  books: Book[] = [];
  loading = false;
  error = '';
  addedBookIds = new Set<number>();
  addingBookIds = new Set<number>();

  ngOnInit(): void {
    this.loading = true;
    this.bookService.getPublicBooks().subscribe({
      next: (books) => {
        this.books = books;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load books. Please try again.';
        this.loading = false;
      }
    });
  }

  get filteredBooks(): Book[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.books;
    return this.books.filter(
      b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
    );
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredBooks.length / this.pageSize));
  }

  get paginatedBooks(): Book[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredBooks.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  onSearchChange(): void {
    this.currentPage = 1;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  addToMyLibrary(book: Book): void {
    if (this.addedBookIds.has(book.id) || this.addingBookIds.has(book.id)) return;
    this.addingBookIds.add(book.id);
    this.bookService.addPublicBookToMyLibrary(book.id).subscribe({
      next: () => {
        this.addingBookIds.delete(book.id);
        this.addedBookIds.add(book.id);
      },
      error: () => {
        this.addingBookIds.delete(book.id);
      }
    });
  }
}

import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BookService, Book } from '../services/book.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-libary',
  imports: [FormsModule, CommonModule],
  templateUrl: './libary.html',
  styleUrl: './libary.css',
})
export class Libary implements OnInit {
  private bookService = inject(BookService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  searchQuery = '';
  currentPage = 1;
  readonly pageSize = 4;

  books: Book[] = [];
  loading = false;
  error = '';
  addedBookIds = new Set<number>();
  addingBookIds = new Set<number>();

  isModerator = false;
  showUpload = false;
  selectedFile: File | null = null;
  uploadTitle = '';
  uploadAuthor = '';
  isUploading = false;
  uploadError: string | null = null;
  uploadSuccess: string | null = null;

  ngOnInit(): void {
    this.authService.getUserProfile().subscribe({
      next: profile => { this.isModerator = profile.role === 'moderator'; },
      error: () => { this.isModerator = false; }
    });

    this.loadBooks();
  }

  loadBooks(): void {
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

  toggleUpload(): void {
    this.showUpload = !this.showUpload;
    this.uploadError = null;
    this.uploadSuccess = null;
  }

  onFileSelected(event: any): void {
    const file = event.target?.files?.[0] as File | undefined;
    if (!file) return;
    this.selectedFile = file;
    this.uploadTitle = file.name.replace(/\.[^/.]+$/, '');
    this.uploadError = null;
    this.uploadSuccess = null;
  }

  upload(): void {
    if (!this.selectedFile) { this.uploadError = 'Please select a file first'; return; }
    if (this.selectedFile.size === 0) { this.uploadError = 'File is empty'; return; }

    this.isUploading = true;
    this.uploadError = null;
    this.uploadSuccess = null;

    const formData = new FormData();
    formData.append('pdf_file', this.selectedFile);
    formData.append('title', this.uploadTitle || this.selectedFile.name);
    formData.append('author', this.uploadAuthor || '');

    this.bookService.uploadPublicBook(formData).subscribe({
      next: (book) => {
        this.uploadSuccess = `"${book.title}" added to the library.`;
        this.isUploading = false;
        this.selectedFile = null;
        this.uploadTitle = '';
        this.uploadAuthor = '';
        const fileInput = document.getElementById('libFileInput') as HTMLInputElement | null;
        if (fileInput) fileInput.value = '';
        this.books.unshift(book);
        this.cdr.detectChanges();
        setTimeout(() => { this.uploadSuccess = null; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.isUploading = false;
        const data = err?.error;
        if (data && typeof data === 'object') {
          const firstKey = Object.keys(data)[0];
          const msg = Array.isArray(data[firstKey]) ? data[firstKey][0] : data[firstKey];
          this.uploadError = String(msg || 'Upload failed.');
        } else {
          this.uploadError = 'Upload failed. Please try again.';
        }
        this.cdr.detectChanges();
        setTimeout(() => { this.uploadError = null; this.cdr.detectChanges(); }, 5000);
      },
    });
  }

  deleteFromLibrary(bookId: number, bookTitle: string): void {
    if (!confirm(`Remove "${bookTitle}" from the public library?`)) return;
    this.bookService.deletePublicBook(bookId).subscribe({
      next: () => {
        this.books = this.books.filter(b => b.id !== bookId);
        this.currentPage = Math.min(this.currentPage, this.totalPages);
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Failed to delete book.';
        setTimeout(() => { this.error = ''; this.cdr.detectChanges(); }, 5000);
      }
    });
  }
}

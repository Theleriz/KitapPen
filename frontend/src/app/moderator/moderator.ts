import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookService, Book } from '../services/book.service';

@Component({
  selector: 'app-moderator',
  imports: [CommonModule, FormsModule],
  templateUrl: './moderator.html',
  styleUrl: './moderator.css',
})
export class Moderator implements OnInit {
  books: Book[] = [];
  isLoading = false;
  error: string | null = null;

  showUpload = false;
  selectedFile: File | null = null;
  uploadTitle = '';
  uploadAuthor = '';
  isUploading = false;
  uploadError: string | null = null;
  uploadSuccess: string | null = null;

  constructor(private bookService: BookService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadBooks();
  }

  loadBooks(): void {
    this.isLoading = true;
    this.error = null;
    this.bookService.getModeratorBooks().subscribe({
      next: (books) => {
        this.books = books;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Failed to load public library books.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
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
    if (!this.selectedFile) {
      this.uploadError = 'Please select a file first';
      return;
    }
    if (this.selectedFile.size === 0) {
      this.uploadError = 'File is empty';
      return;
    }

    this.isUploading = true;
    this.uploadError = null;
    this.uploadSuccess = null;

    const formData = new FormData();
    formData.append('pdf_file', this.selectedFile);
    formData.append('title', this.uploadTitle || this.selectedFile.name);
    formData.append('author', this.uploadAuthor || '');

    this.bookService.uploadPublicBook(formData).subscribe({
      next: (book) => {
        this.uploadSuccess = `"${book.title}" added to public library.`;
        this.isUploading = false;
        this.selectedFile = null;
        this.uploadTitle = '';
        this.uploadAuthor = '';
        const fileInput = document.getElementById('modFileInput') as HTMLInputElement | null;
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
          this.uploadError = String(msg || 'Upload failed. Please try again.');
        } else {
          this.uploadError = 'Upload failed. Please try again.';
        }
        this.cdr.detectChanges();
        setTimeout(() => { this.uploadError = null; this.cdr.detectChanges(); }, 5000);
      },
    });
  }

  deleteBook(bookId: number, bookTitle: string): void {
    if (!confirm(`Remove "${bookTitle}" from the public library?`)) return;
    this.bookService.deletePublicBook(bookId).subscribe({
      next: () => {
        this.books = this.books.filter(b => b.id !== bookId);
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Failed to delete book. Please try again.';
        this.cdr.detectChanges();
        setTimeout(() => { this.error = null; this.cdr.detectChanges(); }, 5000);
      },
    });
  }
}

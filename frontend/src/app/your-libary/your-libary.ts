import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BookService, Book } from '../services/book.service';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

type ReadingStatus = 'reading' | 'completed' | 'not_started';

interface UserBook {
  id: number;
  title: string;
  author: string;
  progressPct: number;
  status: ReadingStatus;
  pages?: number;
}

interface Tab {
  label: string;
  value: 'all' | ReadingStatus;
}

@Component({
  selector: 'app-your-libary',
  imports: [FormsModule, CommonModule],
  templateUrl: './your-libary.html',
  styleUrl: './your-libary.css',
})
export class YourLibary implements OnInit, OnDestroy {
  activeTab: 'all' | ReadingStatus = 'all';
  currentPage = 1;
  readonly pageSize = 3;

  tabs: Tab[] = [
    { label: 'All', value: 'all' },
    { label: 'Reading', value: 'reading' },
    { label: 'Completed', value: 'completed' },
    { label: 'Not started', value: 'not_started' },
  ];

  isLoading = false;
  error: string | null = null;

  books: UserBook[] = [];

  // Upload
  showUpload = false;
  selectedFile: File | null = null;
  uploadTitle = '';
  uploadAuthor = '';
  isUploading = false;
  uploadError: string | null = null;
  uploadSuccess: string | null = null;

  private routerSubscription: Subscription | null = null;

  constructor(private bookService: BookService, private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    console.log('YourLibrary component initialized');
    this.loadBooks();
    
    // Subscribe to router events to detect when user navigates to My Library
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        console.log('Router navigation event:', event.urlAfterRedirects);
        // Check if we're navigating to My Library page (handle various URL patterns)
        const url = event.urlAfterRedirects;
        if (url === '/my-library' || url.startsWith('/my-library?')) {
          console.log('Navigated to My Library, reloading books...');
          this.loadBooks();
        }
      });
  }

  toggleUpload(): void {
    this.showUpload = !this.showUpload;
    this.uploadError = null;
    this.uploadSuccess = null;
  }

  loadBooks(): void {
    // Don't interrupt ongoing upload/delete operations
    if (this.isUploading) {
      console.log('Skipping loadBooks - upload in progress');
      return;
    }
    
    // Prevent multiple simultaneous loading attempts
    if (this.isLoading) {
      console.log('Loading already in progress, skipping...');
      return;
    }
    
    this.isLoading = true;
    this.error = null;
    console.log('Loading books from server...');
    
    this.bookService.getMyBooks().subscribe({
      next: (books: Book[]) => {
        console.log('Books loaded successfully:', books.length);
        this.books = books.map(b => ({
          id: b.id,
          title: b.title,
          author: b.author || 'Unknown Author',
          progressPct: 0,
          status: 'not_started',
          pages: b.total_pages,
        }));
        this.isLoading = false;
        // Reset to first page and 'all' tab after loading
        this.currentPage = 1;
        this.activeTab = 'all';
        // Force UI update
        this.cdr.detectChanges();
        console.log('UI updated with new books');
      },
      error: (err) => {
        console.error('Error loading books:', err);
        this.error = 'Failed to load your books. Please try again.';
        this.isLoading = false;
        this.books = []; // Clear books on error
        // Force UI update
        this.cdr.detectChanges();
        
        // Auto-clear error message after 5 seconds
        setTimeout(() => {
          this.error = null;
          this.cdr.detectChanges();
        }, 5000);
      },
    });
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

    this.bookService.uploadBook(formData).subscribe({
      next: (newBook) => {
        console.log('Book uploaded successfully:', newBook.title);
        this.uploadSuccess = 'Book uploaded successfully!';
        this.isUploading = false;
        this.isLoading = false; // Reset loading state
        this.selectedFile = null;
        this.uploadTitle = '';
        this.uploadAuthor = '';
        const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
        if (fileInput) fileInput.value = '';
        
        // Add the new book directly to the books array to avoid loading issues
        const userBook: UserBook = {
          id: newBook.id,
          title: newBook.title,
          author: newBook.author || 'Unknown Author',
          progressPct: 0,
          status: 'not_started',
          pages: newBook.total_pages,
        };
        this.books.unshift(userBook); // Add to beginning of array
        
        // Reset to first page and 'all' tab to show the new book
        this.currentPage = 1;
        this.activeTab = 'all';
        
        // Force UI update
        this.cdr.detectChanges();
        
        // Auto-clear success message after 3 seconds
        setTimeout(() => {
          this.uploadSuccess = null;
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (err) => {
        console.error('Upload error:', err);
        this.isUploading = false;
        this.isLoading = false; // Reset loading state
        const data = err?.error;
        if (data && typeof data === 'object') {
          const firstKey = Object.keys(data)[0];
          const msg = Array.isArray(data[firstKey]) ? data[firstKey][0] : data[firstKey];
          this.uploadError = String(msg || 'Failed to upload book. Please try again.');
        } else {
          this.uploadError = 'Failed to upload book. Please try again.';
        }
        // Force UI update
        this.cdr.detectChanges();
        
        // Auto-clear error message after 5 seconds
        setTimeout(() => {
          this.uploadError = null;
          this.cdr.detectChanges();
        }, 5000);
      },
    });
  }

  get filteredBooks(): UserBook[] {
    if (this.activeTab === 'all') return this.books;
    return this.books.filter(b => b.status === this.activeTab);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredBooks.length / this.pageSize));
  }

  get paginatedBooks(): UserBook[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredBooks.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  setTab(tab: 'all' | ReadingStatus): void {
    console.log('Setting tab to:', tab);
    this.activeTab = tab;
    this.currentPage = 1;
    // Ensure we're not in loading state when switching tabs
    this.isLoading = false;
    // Reload books when switching tabs to ensure fresh data
    this.loadBooks();
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

  statusLabel(status: ReadingStatus): string {
    const labels: Record<ReadingStatus, string> = {
      reading: 'Reading',
      completed: 'Completed',
      not_started: 'Not started',
    };
    return labels[status];
  }

  deleteBook(bookId: number, bookTitle: string): void {
    if (confirm(`Are you sure you want to delete "${bookTitle}"?`)) {
      console.log('Deleting book:', bookId);
      this.isLoading = true; // Set loading state for deletion
      
      this.bookService.deleteBook(bookId).subscribe({
        next: () => {
          console.log('Book deleted successfully');
          // Remove book from local array
          this.books = this.books.filter(book => book.id !== bookId);
          // Reset to first page if current page becomes empty
          if (this.currentPage > this.totalPages && this.currentPage > 1) {
            this.currentPage = Math.max(1, this.totalPages);
          }
          this.isLoading = false; // Reset loading state
          // Force UI update
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error deleting book:', err);
          this.isLoading = false; // Reset loading state on error
          // Show error message instead of alert
          this.uploadError = 'Failed to delete book. Please try again.';
          // Force UI update
          this.cdr.detectChanges();
          
          // Auto-clear error message after 5 seconds
          setTimeout(() => {
            this.uploadError = null;
            this.cdr.detectChanges();
          }, 5000);
        }
      });
    }
  }

  ngOnDestroy(): void {
    // Clean up router subscription to prevent memory leaks
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
      this.routerSubscription = null;
    }
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Book {
  id: number;
  title: string;
  author: string;
  pdf_file?: string;
  uploaded_at: string;
  total_pages: number;
  last_page?: number;
  is_public: boolean;
  user?: number;
}

@Injectable({
  providedIn: 'root'
})
export class BookService {
  private apiUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  // Get public books (Library - admin catalog)
  getPublicBooks(): Observable<Book[]> {
    return this.http.get<Book[]>(`${this.apiUrl}/books/public/`, {
      headers: this.getAuthHeaders()
    });
  }

  // Get user's books (My Library)
  getMyBooks(): Observable<Book[]> {
    return this.http.get<Book[]>(`${this.apiUrl}/books/my/`, {
      headers: this.getAuthHeaders()
    });
  }

  // Upload a new book (to My Library)
  uploadBook(formData: FormData): Observable<Book> {
    return this.http.post<Book>(`${this.apiUrl}/books/`, formData, {
      headers: this.getAuthHeaders()
    });
  }

  // Add a public book to My Library (without re-upload)
  addPublicBookToMyLibrary(bookId: number): Observable<Book> {
    return this.http.post<Book>(`${this.apiUrl}/books/public/${bookId}/add/`, null, {
      headers: this.getAuthHeaders()
    });
  }

  // Delete a book
  deleteBook(bookId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/books/${bookId}/`, {
      headers: this.getAuthHeaders()
    });
  }

  // Get book detail
  getBook(bookId: number): Observable<Book> {
    return this.http.get<Book>(`${this.apiUrl}/books/${bookId}/`, {
      headers: this.getAuthHeaders()
    });
  }
}

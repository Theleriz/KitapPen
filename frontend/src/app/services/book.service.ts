import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
  private apiUrl = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient) {}

  getPublicBooks(): Observable<Book[]> {
    return this.http.get<Book[]>(`${this.apiUrl}/books/public/`);
  }

  getMyBooks(): Observable<Book[]> {
    return this.http.get<Book[]>(`${this.apiUrl}/books/my/`);
  }

  uploadBook(formData: FormData): Observable<Book> {
    return this.http.post<Book>(`${this.apiUrl}/books/`, formData);
  }

  addPublicBookToMyLibrary(bookId: number): Observable<Book> {
    return this.http.post<Book>(`${this.apiUrl}/books/public/${bookId}/add/`, null);
  }

  deleteBook(bookId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/books/${bookId}/`);
  }

  getBook(bookId: number): Observable<Book> {
    return this.http.get<Book>(`${this.apiUrl}/books/${bookId}/`);
  }

  getBookStream(bookId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/books/${bookId}/stream/`, { responseType: 'blob' });
  }

  updateLastPage(bookId: number, page: number, totalPages?: number): Observable<{ last_page: number; total_pages: number }> {
    const body: Record<string, number> = { last_page: page };
    if (totalPages !== undefined) body['total_pages'] = totalPages;
    return this.http.patch<{ last_page: number; total_pages: number }>(`${this.apiUrl}/books/${bookId}/progress/`, body);
  }
}

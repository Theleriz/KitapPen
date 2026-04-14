import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Book {
  id: number;
  title: string;
  author: string;
  pages: number;
}

@Component({
  selector: 'app-libary',
  imports: [FormsModule],
  templateUrl: './libary.html',
  styleUrl: './libary.css',
})
export class Libary {
  searchQuery = '';

  books: Book[] = [
    { id: 1, title: 'The Great Gatsby',         author: 'F. Scott Fitzgerald', pages: 180 },
    { id: 2, title: 'To Kill a Mockingbird',     author: 'Harper Lee',          pages: 281 },
    { id: 3, title: '1984',                      author: 'George Orwell',       pages: 328 },
    { id: 4, title: 'Pride and Prejudice',       author: 'Jane Austen',         pages: 432 },
    { id: 5, title: 'The Catcher in the Rye',    author: 'J.D. Salinger',       pages: 277 },
    { id: 6, title: 'Brave New World',           author: 'Aldous Huxley',       pages: 311 },
  ];

  get filteredBooks(): Book[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.books;
    return this.books.filter(
      b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
    );
  }
}

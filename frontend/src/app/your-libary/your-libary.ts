import { Component } from '@angular/core';

type ReadingStatus = 'reading' | 'completed' | 'not_started';

interface UserBook {
  id: number;
  title: string;
  author: string;
  progressPct: number;
  status: ReadingStatus;
}

interface Tab {
  label: string;
  value: 'all' | ReadingStatus;
}

@Component({
  selector: 'app-your-libary',
  imports: [],
  templateUrl: './your-libary.html',
  styleUrl: './your-libary.css',
})
export class YourLibary {
  activeTab: 'all' | ReadingStatus = 'all';

  tabs: Tab[] = [
    { label: 'All',         value: 'all' },
    { label: 'Reading',     value: 'reading' },
    { label: 'Completed',   value: 'completed' },
    { label: 'Not started', value: 'not_started' },
  ];

  books: UserBook[] = [
    { id: 1, title: '1984',                   author: 'George Orwell',       progressPct: 68, status: 'reading' },
    { id: 2, title: 'Brave New World',         author: 'Aldous Huxley',       progressPct: 100, status: 'completed' },
    { id: 3, title: 'The Great Gatsby',        author: 'F. Scott Fitzgerald', progressPct: 0,  status: 'not_started' },
  ];

  get filteredBooks(): UserBook[] {
    if (this.activeTab === 'all') return this.books;
    return this.books.filter(b => b.status === this.activeTab);
  }

  statusLabel(status: ReadingStatus): string {
    const labels: Record<ReadingStatus, string> = {
      reading:     'Reading',
      completed:   'Completed',
      not_started: 'Not started',
    };
    return labels[status];
  }
}

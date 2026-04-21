# KitapPen

Book reading tracker with CV-based reading detection, notes, statistics, and a public library.

**Authors:** Zhanat Rishat · Rashi Erbol · Bakytzhan Anel

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21, TypeScript |
| Backend | Django 5 + Django REST Framework |
| Auth | JWT (SimpleJWT) — access 60 min / refresh 7 days |
| Database | SQLite (file — `backend/db.sqlite3`) |
| File storage | MinIO (S3-compatible) |
| Reading detection | MediaPipe Face Landmarker + OpenCV (headless) |
| Containerisation | Docker + Docker Compose |

---

## Architecture

```
Browser
  │
  ├─► :4200  Angular SPA (ng serve)
  │             │  REST calls
  └─► :8000  Django REST API
                │
                ├── SQLite  (backend/db.sqlite3)
                ├── media/  (local PDF uploads)
                └── :9000  MinIO  (object storage for PDFs)
                              └── :9001  MinIO Console
```

**Docker Compose services:**

| Service | Role | Port |
|---|---|---|
| `frontend` | Angular dev server | 4200 |
| `backend` | Django REST API | 8000 |
| `minio` | Object storage | 9000 (API), 9001 (Console) |
| `cron` | Email reminder job (runs every hour) | — |

**Data models:** `Book`, `Note`, `ReadingSession`, `UserNotificationSettings`, `UserProfile`

---

## Available API Endpoints

Base prefix: `/api/`

### Auth
| Method | URL | Description |
|---|---|---|
| POST | `/auth/register/` | Register a new user |
| POST | `/auth/login/` | Login → `{ access, refresh }` |
| POST | `/auth/refresh/` | Refresh access token |
| POST | `/auth/logout/` | Blacklist refresh token |
| GET | `/auth/me/` | Get current user profile |
| PUT | `/auth/me/` | Update username / email |

### Books
| Method | URL | Description |
|---|---|---|
| GET | `/books/` | List user's private books |
| POST | `/books/` | Upload a new book (PDF) |
| GET | `/books/public/` | Public library catalog |
| GET | `/books/my/` | My library |
| POST | `/books/public/{id}/add/` | Add public book to my library |
| GET | `/books/{id}/` | Book detail |
| DELETE | `/books/{id}/` | Delete book |
| GET | `/books/{id}/stream/` | Stream PDF file |
| PATCH | `/books/{id}/progress/` | Save last read page |

### Notes
| Method | URL | Description |
|---|---|---|
| GET | `/notes/` | List notes (`?book={id}` to filter) |
| POST | `/notes/` | Create note |
| GET | `/notes/{id}/` | Note detail |
| PUT | `/notes/{id}/` | Update note |
| DELETE | `/notes/{id}/` | Delete note |

### Reading
| Method | URL | Description |
|---|---|---|
| POST | `/reading/ping/` | Send webcam frame → detect reading |
| POST | `/reading/stop/` | End active session |
| GET | `/reading/sessions/` | Paginated session history |
| GET | `/reading/week/` | Reading time by day for current week |
| GET | `/reading/stats/` | Total time, streak, daily average, session count |
| GET | `/reading/leaderboard/` | Top 10 users by read time and day streak |

### Notifications
| Method | URL | Description |
|---|---|---|
| GET | `/notifications/settings/` | Get notification preferences |
| PUT | `/notifications/settings/` | Update notification preferences |
| POST | `/notifications/send/` | Send email to users (admin only) |

### Moderator
| Method | URL | Description |
|---|---|---|
| GET | `/moderator/books/` | List public books |
| POST | `/moderator/books/` | Add book to public library |
| DELETE | `/moderator/books/{id}/` | Remove book from public library |

---

## Running Locally (Native)

### Prerequisites

- Python 3.12+
- Node.js 20+ and npm
- The `face_landmarker.task` file must be present in `backend/`

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Apply migrations
python manage.py migrate

# Start dev server
python manage.py runserver
```

Backend available at `http://127.0.0.1:8000`

**Optional — email reminders:**
```bash
python manage.py send_reading_reminders
```

### Frontend

```bash
cd frontend

npm install
npx ng serve
```

Frontend available at `http://localhost:4200`

### Environment variables (optional)

Create `backend/.env` to override defaults:

```env
# Email (required for notification emails)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your@gmail.com
EMAIL_HOST_PASSWORD=your_app_password
DEFAULT_FROM_EMAIL=KitapPen <your@gmail.com>

# MinIO (only if you run MinIO locally)
MINIO_ENDPOINT=localhost:9000
```

---

## Running with Docker

### Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin)

### Start all services

```bash
docker compose up --build
```

| URL | Service |
|---|---|
| `http://localhost:4200` | Angular frontend |
| `http://localhost:8000/api/` | Django REST API |
| `http://localhost:9000` | MinIO S3 endpoint |
| `http://localhost:9001` | MinIO web console |

MinIO credentials: **minioadmin / minioadmin**

### Useful commands

```bash
# Start in background
docker compose up -d --build

# View logs for a specific service
docker compose logs -f backend

# Stop everything
docker compose down

# Stop and remove volumes (resets MinIO data)
docker compose down -v

# Rebuild a single service
docker compose build backend
```

### Notes

- `db.sqlite3` and `media/` are stored on the host inside `backend/` via a volume mount — data persists across container restarts.
- Migrations run automatically on backend startup.
- The `cron` container runs `send_reading_reminders` every hour.
- Browse uploaded PDFs in the MinIO console at `http://localhost:9001`.

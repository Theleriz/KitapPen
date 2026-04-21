## About project  
KitapPen is servise for tracking, and writing notes for books.

## Creaters
Zhanat Rishat
Rashi Erbol
Bakytzhan Anel

## REST API эндпоинты

```
POST   /api/auth/register/
POST   /api/auth/login/          → { access, refresh }
POST   /api/auth/refresh/

GET    /api/books/               → список книг пользователя
POST   /api/books/               → загрузить PDF
GET    /api/books/{id}/
DELETE /api/books/{id}/
GET    /api/books/{id}/stream/   → стриминг PDF из MinIO

GET    /api/notes/               → все заметки (фильтр: ?book=id)
POST   /api/notes/
GET    /api/notes/{id}/
PUT    /api/notes/{id}/
DELETE /api/notes/{id}/

POST   /api/reading/ping/        → { frame: base64, session_id: int|null }
                                 ← { ok, reading, confidence, session_id, total_seconds }
POST   /api/reading/stop/        → { session_id: int }
GET    /api/reading/stats/       → { total_seconds, streak_days, avg_per_day, sessions_count }

```


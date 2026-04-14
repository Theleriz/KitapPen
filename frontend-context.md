# BookTracker — Frontend Technical Context

## 1. Overview
**BookTracker** — это SPA на Angular для чтения PDF-книг с интегрированным модулем компьютерного зрения (CV) для автоматического учета чистого времени чтения.

## 2. Tech Stack
* **Framework:** Angular (v16+).
* **Auth:** JWT (Access/Refresh tokens).
* **PDF Engine:** `ng2-pdf-viewer` или `PDF.js`.
* **Styling:** SCSS, адаптивная верстка под десктоп и планшеты.
* **Storage:** `localStorage` для JWT и базовых настроек.

## 3. Authentication & Security
Модуль авторизации изолирован и работает через `AuthService`.

### Login Page (`/login`)
* **Поля:** `username` (или email) и `password`.
* **Логика:** Получение пары токенов `{access, refresh}`.
* **UX:** Скрытие основного Navbar, индикация загрузки.

### Register Page (`/register`)
* **Поля:** `username`, `email`, `password`, `confirmPassword`.
* **Валидация:** Кастомный валидатор на совпадение паролей, проверка сложности (8+ символов).
* **Поток:** После регистрации — автоматический редирект на `/login` или автоматический вход.

### Security Infrastructure
* **AuthGuard:** Блокирует доступ к внутренним страницам для неавторизованных пользователей.
* **AuthInterceptor:** Автоматически подставляет `Authorization: Bearer <token>` во все исходящие API-запросы.
* **Token Refresh:** Механизм обновления access-токена при получении 401 ошибки.

## 4. Project Structure (src/app/)
* **core/**: `AuthService`, `ReadingService` (CV-логика), `BookService`, `NoteService`, `AuthGuard`, `AuthInterceptor`.
* **shared/**: `NavbarComponent` (с активной кнопкой "Track reading").
* **modules/**:
    * `auth/`: Компоненты Login и Register.
    * `library/`: Глобальный каталог и "Моя библиотека".
    * `reader/`: Просмотр PDF, переход по страницам, сохранение прогресса.
    * `notes/`: CRUD заметок с фильтром по `book_id`.
    * `track-reading/`: Интерфейс сессии с веб-камерой.
    * `statistics/`: Графики и статистика (стрики, среднее время).

## 5. CV Reading Tracking Logic
Ключевая особенность, реализованная в `TrackReadingComponent` и `ReadingService`:
1.  **Камера:** Доступ через `navigator.mediaDevices.getUserMedia`.
2.  **Захват:** Скрытый `canvas` делает скриншот кадра.
3.  **Формат:** JPEG (quality 0.7), 320×240 px, base64.
4.  **Цикл Ping:** `setInterval` каждые 15–30 секунд отправляет запрос на `POST /api/reading/ping/`.
5.  **Тело запроса:** `{ frame: string, session_id: number | null, book_id: number }`.
6.  **Обработка ответа:** Сервер возвращает `{ reading: boolean, confidence: float }`. Если `reading: true`, фронтенд визуально подтверждает активность трекинга.
7.  **Локальный таймер:** Секундомер работает на фронтенде независимо, но синхронизируется с данными бэкенда при каждом пинге.

## 6. API Endpoints
* `POST /api/auth/register/` — Регистрация.
* `POST /api/auth/login/` — Получение токенов.
* `GET /api/books/` — Список книг.
* `GET /api/books/{id}/stream/` — Поток PDF-файла.
* `GET /api/notes/?book={id}` — Заметки к конкретной книге.
* `POST /api/reading/ping/` — Отправка кадра для анализа.
* `POST /api/reading/stop/` — Принудительное завершение сессии.
* `GET /api/reading/stats/` — Данные для дашборда статистики.

## 7. UI/UX States
* **Navbar:** Подсвечивает активный раздел. Кнопка "Track reading" имеет выделяющийся стиль (акцент).
* **Reader:** Интегрированная панель для быстрого создания заметок, не выходя из режима чтения.
* **Responsive:** Мобильное меню (бургер) для навигации на узких экранах.
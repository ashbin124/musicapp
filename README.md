# Wavebox

Wavebox is a full-stack personal music streaming app for a small administrator-uploaded library. It uses Django REST Framework, JWT auth, PostgreSQL, React, Vite, a persistent browser audio player, IndexedDB offline downloads, Media Session API hooks, and a PWA app shell.

## Stack

- Backend: Python, Django, Django REST Framework, Simple JWT, Mutagen metadata extraction
- Database: PostgreSQL
- Frontend: React, Vite, React Router, Axios, responsive CSS
- Offline/PWA: service worker app shell, manifest, IndexedDB audio downloads

## 1. Backend Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp backend/.env.example backend/.env
```

Fill `backend/.env` with local values for `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DATABASE_URL`, CORS, and CSRF origins. Do not commit real `.env` files.

Start PostgreSQL with Docker:

```bash
docker compose up -d postgres
```

Or create the database yourself:

```bash
createdb musicapp
```

Run migrations and create an admin:

```bash
cd backend
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

The backend API runs at `http://localhost:8000/api/`.

## 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL=http://127.0.0.1:8000/api` in `frontend/.env` for local development.

The Vite app runs at `http://localhost:5173/`.

## 3. First Song Upload

1. Create a superuser with `python manage.py createsuperuser`.
2. Login to Wavebox with that admin account.
3. Open `Admin`.
4. Select an MP3, M4A, AAC, or WAV file.
5. Enter the song title and artist manually.
6. Optionally enter a release year, then upload.

Normal users can browse and listen but cannot upload, edit, replace, or delete music.

## 4. Registration and Login Test

Start both servers, then:

1. Open `http://localhost:5173/register`.
2. Create a normal user account.
3. Login and confirm the Home, Search, Library, Liked Songs, Playlists, player, and Downloads pages are available.
4. Confirm `Admin` is not shown for a normal user.

JWT access and refresh tokens are stored locally in the browser and refreshed automatically.

## 5. Offline Playback Test

1. Login and upload at least one song as admin.
2. Open Library or Liked Songs.
3. Press the download icon on a song, playlist, or liked collection.
4. Open `Downloads` and confirm the song count and storage estimate.
5. Disable the network in browser devtools.
6. Play a downloaded song from Downloads.
7. Try playing a non-downloaded song while offline; the UI should fail gracefully.

Offline audio is device-specific and stored in IndexedDB.

## 6. PWA Build

```bash
cd frontend
npm run build
npm run preview
```

The production build registers `public/sw.js`, exposes `manifest.webmanifest`, and can be installed by supported browsers. Background playback depends on browser and OS behavior; the player is structured so the app can later be wrapped with Capacitor if stronger mobile background playback is needed.

## 7. Tests

Backend:

```bash
cd backend
USE_SQLITE=true python manage.py test
```

Frontend:

```bash
cd frontend
npm run test
npm run lint
npm run build
```

Backend tests cover authentication, admin upload permissions, likes, playlist CRUD, and playlist ordering. Frontend tests cover queue, shuffle, repeat, and play-next logic.

## 8. API Overview

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/refresh/`
- `GET /api/auth/me/`
- `GET /api/home/`
- `GET /api/search/?q=...`
- `GET/POST /api/songs/`
- `POST /api/songs/metadata/`
- `POST /api/songs/bulk_upload/`
- `POST /api/songs/{id}/like/`
- `DELETE /api/songs/{id}/unlike/`
- `GET/POST /api/playlists/`
- `POST /api/playlists/{id}/add_song/`
- `DELETE /api/playlists/{id}/entries/{entry_id}/`
- `POST /api/playlists/{id}/reorder/`
- `GET/PUT /api/playback-state/`
- `GET/POST /api/recently-played/`

## 9. Deployment Notes

The project is intentionally split for separate deployment:

- Deploy `backend/` as a Django API service.
- Deploy PostgreSQL as a managed database or container.
- Serve media files from durable object storage in production.
- Deploy `frontend/` as static Vite output.
- Set production `DJANGO_SECRET_KEY`, `DATABASE_URL`, `ALLOWED_HOSTS`, CORS, CSRF, and media storage settings through environment variables.

Do not commit `.env`, uploaded media, virtual environments, `node_modules`, or build output.

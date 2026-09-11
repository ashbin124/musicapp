# Wavebox Deployment Guide

This guide deploys the existing Wavebox app without rebuilding it.

Target:

- Frontend: Vercel free tier
- Backend: Render free web service
- Database: Supabase PostgreSQL free tier
- Media/audio: Cloudflare R2

## Current Project Audit

- Frontend folder: `frontend/`
- Backend folder: `backend/`
- Django project module: `config`
- Django settings file: `backend/config/settings.py`
- Django WSGI module: `config.wsgi:application`
- Local database config: `DATABASE_URL`, defaulting to local PostgreSQL database `musicapp`
- Production database config: `DATABASE_URL` from Supabase
- Local media storage: `backend/media/`, ignored by Git
- Production media storage: Cloudflare R2 via `django-storages` when R2 env vars are set
- CORS config: `CORS_ALLOWED_ORIGINS` env var
- CSRF config: `CSRF_TRUSTED_ORIGINS` env var
- Frontend API config: `VITE_API_BASE_URL`
- PWA files: `frontend/public/manifest.webmanifest`, `frontend/public/sw.js`, `frontend/public/icon.svg`

## Production Readiness Notes

- Render free services can sleep when inactive, so the first request after inactivity may be slow.
- Render local filesystem is not durable for uploads, so production audio should use R2.
- If R2 is not configured, the app can serve uploaded media from Render's local filesystem as a demo fallback, but uploads can disappear after redeploys/restarts.
- Supabase free tier limits storage/compute and may pause or restrict usage depending on current plan rules.
- R2 audio must be reachable by the browser over HTTPS. Use an R2 public/custom domain and configure CORS.
- iPhone PWA install works through Safari: Share -> Add to Home Screen.

## 1. Push Project to GitHub

Already completed locally:

```bash
git remote add origin https://github.com/ashbin124/musicapp.git
git branch -M main
git push -u origin main
```

For future changes:

```bash
git add .
git commit -m "Describe change"
git push
```

## 2. Create Supabase PostgreSQL

1. Create a Supabase project.
2. Open Project Settings -> Database.
3. Copy the PostgreSQL connection string.
4. Use it as `DATABASE_URL` on Render.
5. Keep the password outside GitHub.

Use the pooled connection string if Supabase recommends it for serverless/free-tier usage.

## 3. Create Cloudflare R2 Bucket

1. In Cloudflare, create an R2 bucket for Wavebox audio.
2. Create R2 API credentials with access to that bucket.
3. Copy:
   - Access key ID
   - Secret access key
   - Bucket name
   - S3 endpoint URL
4. Configure a public R2 URL or custom domain for browser audio playback.

Required backend env vars:

```text
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_ENDPOINT_URL
R2_PUBLIC_URL
R2_REGION_NAME=auto
R2_ADDRESSING_STYLE=virtual
```

## 4. Configure R2 CORS

Allow the deployed Vercel frontend to read audio files.

Example CORS rule:

```json
[
  {
    "AllowedOrigins": ["https://YOUR-VERCEL-APP.vercel.app"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

During testing, you may temporarily include local development origins:

```text
http://localhost:5173
http://127.0.0.1:5173
```

Remove unnecessary origins for production.

## 5. Create Render Backend

Create a new Render Web Service from the GitHub repository.

Use:

- Root directory: leave blank / repository root
- Runtime: Python
- Build command: `./build.sh`
- Start command: `python backend/manage.py migrate && gunicorn config.wsgi:application --chdir backend`

Alternatively, use the repository `render.yaml` blueprint and fill every `sync: false` environment variable in Render.

Set Render environment variables:

```text
DJANGO_SECRET_KEY=<long random secret>
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=<your-render-host>.onrender.com
DATABASE_URL=<Supabase PostgreSQL connection string>
CORS_ALLOWED_ORIGINS=https://YOUR-VERCEL-APP.vercel.app
CSRF_TRUSTED_ORIGINS=https://YOUR-VERCEL-APP.vercel.app,https://<your-render-host>.onrender.com
JWT_ACCESS_MINUTES=30
JWT_REFRESH_DAYS=14
MUSIC_MAX_UPLOAD_SIZE_MB=80
R2_ACCESS_KEY_ID=<Cloudflare R2 access key id>
R2_SECRET_ACCESS_KEY=<Cloudflare R2 secret key>
R2_BUCKET_NAME=<bucket name>
R2_ENDPOINT_URL=<R2 S3 endpoint URL>
R2_PUBLIC_URL=<R2 public/custom HTTPS URL>
R2_REGION_NAME=auto
R2_ADDRESSING_STYLE=virtual
```

Render automatically provides `RENDER_EXTERNAL_HOSTNAME`; the Django settings include it in `ALLOWED_HOSTS`.

## 6. Run Migrations on Render

The Render start command runs migrations before starting Gunicorn:

```bash
python backend/manage.py migrate
```

If you use a paid Render service with one-off jobs or shell access, you can run the command manually instead. Create an admin user after the backend is deployed:

```bash
python backend/manage.py createsuperuser
```

Use the admin account inside the Wavebox app to upload songs.

## 7. Create Vercel Frontend

Create a Vercel project from the same GitHub repository.

Use:

- Root directory: `frontend`
- Framework preset: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

Set Vercel environment variable:

```text
VITE_API_BASE_URL=https://<your-render-host>.onrender.com/api
```

Deploy the frontend.

The file `frontend/vercel.json` rewrites nested routes to `index.html` so React Router routes refresh correctly.

## 8. Update Backend CORS After Vercel Deploy

After Vercel gives the final URL:

1. Copy the frontend URL.
2. Update Render env vars:

```text
CORS_ALLOWED_ORIGINS=https://YOUR-VERCEL-APP.vercel.app
CSRF_TRUSTED_ORIGINS=https://YOUR-VERCEL-APP.vercel.app,https://<your-render-host>.onrender.com
```

3. Redeploy the Render backend.

Do not set `CORS_ALLOW_ALL_ORIGINS=True` for production.

## 9. Local Development Values

Backend `backend/.env`:

```text
DJANGO_SECRET_KEY=<local random secret>
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgresql:///musicapp
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
JWT_ACCESS_MINUTES=30
JWT_REFRESH_DAYS=14
MUSIC_MAX_UPLOAD_SIZE_MB=80
```

Frontend `frontend/.env`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

## 10. Final Test Checklist

Backend:

```bash
python backend/manage.py check
python backend/manage.py migrate
```

In the deployed app, verify:

- Registration
- Login
- Admin-only song upload
- Song list/detail APIs
- Likes
- Playlists
- Playlist ordering
- Recently played
- Continue listening
- Django admin login

Frontend:

- Login
- Home page
- Search
- Library
- Artist pages
- Liked Songs
- Playlists
- Player controls
- Queue
- Shuffle/repeat
- Mobile mini-player
- Now Playing page
- Offline downloads
- Storage usage display
- PWA install prompt or browser install option

Phone/iPhone:

1. Open the Vercel URL in Safari.
2. Login.
3. Play one song.
4. Create a playlist.
5. Like a song.
6. Download one song offline.
7. Turn off network and play the downloaded song.
8. Safari -> Share -> Add to Home Screen.
9. Open from Home Screen and verify login/player behavior.

## Useful Official Docs

- Render Django deploy: https://render.com/docs/deploy-django
- Vercel Vite deploy: https://vercel.com/docs/frameworks/frontend/vite
- Vercel rewrites: https://vercel.com/docs/routing/rewrites
- django-storages: https://django-storages.readthedocs.io/
- Cloudflare R2 docs: https://developers.cloudflare.com/r2/

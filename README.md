# Wavebox

Wavebox is now a frontend-only React + Vite PWA for a personal music library stored on each device.

The app does not require login, Django, PostgreSQL, Supabase, Render, R2, or any cloud music storage at runtime. Imported audio files, song metadata, playlists, liked songs, recently played songs, and playback state are stored in the browser with IndexedDB.

## Stack

- Frontend: React, Vite, React Router, lucide-react
- Storage: IndexedDB for audio blobs and library data
- Settings: localStorage only for small player preferences like volume, shuffle, and repeat
- PWA: Vite static build, web manifest, service worker app shell

## Run Locally

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173/`.

No backend server is needed.

## Use The App

1. Open Wavebox.
2. Go to Add Music.
3. Choose one or more MP3, M4A, AAC, or WAV files from the device.
4. For one song, enter the song name and artist manually.
5. For multiple songs, Wavebox reads embedded metadata when available and falls back to filenames.
6. Use Library, Search, Artists, Albums, Playlists, Liked Songs, Queue, and Now Playing normally.

Each phone, tablet, or browser profile has its own separate local library. Songs do not sync between devices.

## Local Storage Model

IndexedDB stores:

- audio `File`/`Blob` objects
- song title, artist, duration, embedded album data, year, artwork when available
- playlists and playlist order
- liked songs
- recently played songs
- continue listening / playback position

LocalStorage stores only lightweight player settings.

Browser storage can still be limited by the OS. On iPhone, keeping the app installed and using Safari's Add to Home Screen flow gives the best chance of durable storage, but iOS can reclaim website data if storage is low.

## Build And Test

```bash
cd frontend
npm run test
npm run lint
npm run build
```

The production build output is `frontend/dist/`.

## Deploy To Vercel

Create a Vercel project with:

- Root directory: `frontend`
- Framework preset: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

No Vercel environment variables are required.

The `frontend/vercel.json` rewrite sends nested React Router paths back to `index.html`.

## PWA Notes

On iPhone:

1. Open the Vercel URL in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Open Wavebox from the Home Screen icon.
5. Import songs on that same device.

Offline playback works for imported songs stored on that device. Browser background audio behavior depends on iOS/browser rules.

# Wavebox Frontend-Only Deployment

Wavebox now deploys as a React + Vite PWA on Vercel. The runtime app has no backend, no database, no login, and no cloud audio storage.

## Architecture

```text
Vercel
  -> React + Vite PWA
  -> IndexedDB on each device
  -> Local music library and app data
```

Each device stores its own songs locally. There is no account system and no multi-device sync.

## Current Project Layout

- Frontend app: `frontend/`
- Local storage layer: `frontend/src/db/localDb.js`
- Local library service: `frontend/src/services/localLibrary.js`
- Browser metadata reader: `frontend/src/services/audioMetadata.js`
- PWA files: `frontend/public/manifest.webmanifest`, `frontend/public/sw.js`

## Local Verification

```bash
cd frontend
npm install
npm run test
npm run lint
npm run build
```

Run locally:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173/`, go to Add Music, import a test audio file, then verify playback, likes, playlists, search, Storage, and refresh behavior.

## Vercel Setup

Create or update the Vercel project:

- Root directory: `frontend`
- Framework preset: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

Environment variables:

```text
None required
```

Do not set `VITE_API_BASE_URL`. The frontend does not call a backend API.

## GitHub/Vercel Deploy

After committing and pushing:

```bash
git push origin main
```

Vercel should build the frontend automatically from the `frontend` root. If needed, trigger Redeploy in the Vercel dashboard.

## Phone Test

1. Open the Vercel URL on the phone.
2. Confirm the app opens directly without login.
3. Add/install the PWA to the Home Screen.
4. Open from the Home Screen icon.
5. Import 1 to 3 songs from the device.
6. Play a song, like it, add it to a playlist, and search for it.
7. Turn off network and confirm imported songs still play.

## Storage Limits

Imported audio is stored in IndexedDB. For 50 to 100 songs, storage depends on audio file size and the device/browser quota. Compressed MP3/M4A files are much safer than large WAV files.

iOS Safari can reclaim website storage when the device is low on space. There is no cloud backup in this architecture, so songs may need to be imported again on that device if browser data is cleared.

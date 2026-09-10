import { getAccessToken } from '../api/client'

const DB_NAME = 'wavebox-offline'
const DB_VERSION = 1
const STORE = 'songs'

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore(mode, callback) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const store = transaction.objectStore(STORE)
    const result = callback(store)
    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(transaction.error)
  }).finally(() => db.close())
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function downloadSong(song) {
  if (!song?.audio_url) throw new Error('Audio is not available for this song.')
  const headers = {}
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(song.audio_url, { headers })
  if (!response.ok) throw new Error('Download failed.')
  const blob = await response.blob()
  const record = {
    id: song.id,
    song,
    blob,
    size: blob.size,
    downloadedAt: new Date().toISOString(),
  }
  await withStore('readwrite', (store) => store.put(record))
  return record
}

export async function getOfflineSong(songId) {
  return withStore('readonly', (store) => requestToPromise(store.get(songId)))
}

export async function listDownloads() {
  return withStore('readonly', (store) => requestToPromise(store.getAll()))
}

export async function getDownloadedIds() {
  const records = await listDownloads()
  return new Set(records.map((record) => record.id))
}

export async function removeDownload(songId) {
  return withStore('readwrite', (store) => store.delete(songId))
}

export async function clearDownloads() {
  return withStore('readwrite', (store) => store.clear())
}

export async function storageStats() {
  const records = await listDownloads()
  return {
    count: records.length,
    bytes: records.reduce((total, record) => total + (record.size || 0), 0),
  }
}

export async function resolveAudioSource(song) {
  const offline = await getOfflineSong(song.id)
  if (offline?.blob) {
    return {
      url: URL.createObjectURL(offline.blob),
      revoke: true,
      offline: true,
    }
  }
  if (!navigator.onLine) {
    throw new Error('This song is not downloaded on this device.')
  }
  if (!song.audio_url) {
    throw new Error('This song does not have an audio file.')
  }
  return { url: song.audio_url, revoke: false, offline: false }
}

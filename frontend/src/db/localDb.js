export const DB_NAME = 'wavebox-local'
export const DB_VERSION = 1

export const STORES = {
  songs: 'songs',
  playlists: 'playlists',
  likes: 'likes',
  recent: 'recentlyPlayed',
  playback: 'playbackState',
  meta: 'meta',
}

function createStore(db, name, options) {
  if (!db.objectStoreNames.contains(name)) {
    return db.createObjectStore(name, options)
  }
  return null
}

function ensureIndex(store, name, keyPath, options) {
  if (store && !store.indexNames.contains(name)) {
    store.createIndex(name, keyPath, options)
  }
}

export function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      const songs = createStore(db, STORES.songs, { keyPath: 'id' })
      ensureIndex(songs, 'createdAt', 'createdAt')
      ensureIndex(songs, 'artistKey', 'artistKey')
      ensureIndex(songs, 'albumKey', 'albumKey')

      createStore(db, STORES.playlists, { keyPath: 'id' })
      createStore(db, STORES.likes, { keyPath: 'songId' })

      const recent = createStore(db, STORES.recent, { keyPath: 'songId' })
      ensureIndex(recent, 'playedAt', 'playedAt')

      createStore(db, STORES.playback, { keyPath: 'id' })
      createStore(db, STORES.meta, { keyPath: 'key' })
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function getAll(storeName) {
  const db = await openDb()
  try {
    const transaction = db.transaction(storeName, 'readonly')
    const result = await requestToPromise(transaction.objectStore(storeName).getAll())
    await transactionDone(transaction)
    return result
  } finally {
    db.close()
  }
}

export async function getRecord(storeName, key) {
  const db = await openDb()
  try {
    const transaction = db.transaction(storeName, 'readonly')
    const result = await requestToPromise(transaction.objectStore(storeName).get(key))
    await transactionDone(transaction)
    return result
  } finally {
    db.close()
  }
}

export async function putRecord(storeName, value) {
  const db = await openDb()
  try {
    const transaction = db.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(value)
    await transactionDone(transaction)
    return value
  } finally {
    db.close()
  }
}

export async function deleteRecord(storeName, key) {
  const db = await openDb()
  try {
    const transaction = db.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).delete(key)
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function clearStore(storeName) {
  const db = await openDb()
  try {
    const transaction = db.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).clear()
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function runTransaction(storeNames, mode, callback) {
  const db = await openDb()
  try {
    const transaction = db.transaction(storeNames, mode)
    const stores = Object.fromEntries(
      storeNames.map((storeName) => [storeName, transaction.objectStore(storeName)]),
    )
    const result = callback(stores)
    await transactionDone(transaction)
    return result
  } finally {
    db.close()
  }
}

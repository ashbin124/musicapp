import { getAll, getRecord, putRecord, deleteRecord, clearStore, STORES } from '../db/localDb'
import { readAudioMetadata } from './audioMetadata'

export const LIBRARY_CHANGED_EVENT = 'wavebox:library-changed'

const DEFAULT_PLAYLISTS = ['Hindi', 'My Fav', 'Driving', 'Sleeping']
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav']

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix) {
  const value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  return `${prefix}_${value}`
}

export function normalizeLabel(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

function encodeEntityId(value) {
  const encoded = btoa(unescape(encodeURIComponent(value || 'unknown')))
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeEntityId(value) {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = `${normalized}${'='.repeat((4 - (normalized.length % 4)) % 4)}`
    return decodeURIComponent(escape(atob(padded)))
  } catch {
    return ''
  }
}

function isAudioFile(file) {
  const name = file.name.toLocaleLowerCase()
  return file.type.startsWith('audio/') || AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext))
}

function artistFromSong(song) {
  const name = song.artistName || 'Unknown Artist'
  const key = song.artistKey || normalizeLabel(name)
  return { id: encodeEntityId(key), name }
}

function albumFromSong(song) {
  if (!song.albumTitle) return null
  const artist = artistFromSong(song)
  const albumKey = song.albumKey || normalizeLabel(song.albumTitle)
  return {
    id: encodeEntityId(`${song.artistKey || artist.id}::${albumKey}`),
    title: song.albumTitle,
    artist,
    year: song.release_year || null,
    artwork_url: song.artworkDataUrl || null,
  }
}

function viewSong(song, likedIds = new Set()) {
  return {
    id: song.id,
    title: song.title,
    artist: artistFromSong(song),
    album: albumFromSong(song),
    audio_url: `local://${song.id}`,
    artwork_url: song.artworkDataUrl || null,
    duration_seconds: song.duration_seconds || 0,
    release_year: song.release_year || null,
    liked: likedIds.has(song.id),
    original_filename: song.original_filename,
    created_at: song.createdAt,
    updated_at: song.updatedAt,
  }
}

function sortRecent(a, b) {
  return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
}

function sortTitle(a, b) {
  return a.title.localeCompare(b.title)
}

function emitLibraryChanged(detail = {}) {
  window.dispatchEvent(new CustomEvent(LIBRARY_CHANGED_EVENT, { detail }))
}

async function likedIds() {
  const likes = await getAll(STORES.likes)
  return new Set(likes.map((like) => like.songId))
}

async function rawSongs() {
  return (await getAll(STORES.songs)).sort(sortRecent)
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function ensureDefaultPlaylists() {
  const marker = await getRecord(STORES.meta, 'defaultPlaylistsCreated')
  if (marker) return

  const createdAt = nowIso()
  for (const name of DEFAULT_PLAYLISTS) {
    await putRecord(STORES.playlists, {
      id: createId('playlist'),
      name,
      entries: [],
      createdAt,
      updatedAt: createdAt,
    })
  }
  await putRecord(STORES.meta, { key: 'defaultPlaylistsCreated', value: true })
}

export async function listSongs() {
  const [songs, likes] = await Promise.all([rawSongs(), likedIds()])
  return songs.map((song) => viewSong(song, likes))
}

export async function getSong(songId) {
  const [song, likes] = await Promise.all([getRecord(STORES.songs, songId), likedIds()])
  return song ? viewSong(song, likes) : null
}

export async function listArtists() {
  const songs = await rawSongs()
  const artists = new Map()
  for (const song of songs) {
    const key = song.artistKey || normalizeLabel(song.artistName)
    const current = artists.get(key) || {
      id: encodeEntityId(key),
      name: song.artistName || 'Unknown Artist',
      song_count: 0,
      created_at: song.createdAt,
      updated_at: song.updatedAt,
    }
    current.song_count += 1
    artists.set(key, current)
  }
  return [...artists.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export async function getArtist(id) {
  const key = decodeEntityId(id)
  const artists = await listArtists()
  return artists.find((artist) => decodeEntityId(artist.id) === key) || null
}

export async function songsByArtist(id) {
  const key = decodeEntityId(id)
  const [songs, likes] = await Promise.all([rawSongs(), likedIds()])
  return songs
    .filter((song) => (song.artistKey || normalizeLabel(song.artistName)) === key)
    .sort(sortTitle)
    .map((song) => viewSong(song, likes))
}

export async function listAlbums() {
  const songs = await rawSongs()
  const albums = new Map()
  for (const song of songs) {
    if (!song.albumTitle) continue
    const artistKey = song.artistKey || normalizeLabel(song.artistName)
    const albumKey = song.albumKey || normalizeLabel(song.albumTitle)
    const key = `${artistKey}::${albumKey}`
    const current = albums.get(key) || {
      id: encodeEntityId(key),
      title: song.albumTitle,
      artist: artistFromSong(song),
      year: song.release_year || null,
      artwork_url: song.artworkDataUrl || null,
      song_count: 0,
      total_duration_seconds: 0,
      created_at: song.createdAt,
      updated_at: song.updatedAt,
    }
    current.song_count += 1
    current.total_duration_seconds += song.duration_seconds || 0
    if (!current.artwork_url && song.artworkDataUrl) current.artwork_url = song.artworkDataUrl
    albums.set(key, current)
  }
  return [...albums.values()].sort((a, b) => a.title.localeCompare(b.title))
}

export async function albumsByArtist(id) {
  const artistKey = decodeEntityId(id)
  const albums = await listAlbums()
  return albums.filter((album) => decodeEntityId(album.artist.id) === artistKey)
}

export async function getAlbum(id) {
  const key = decodeEntityId(id)
  const albums = await listAlbums()
  return albums.find((album) => decodeEntityId(album.id) === key) || null
}

export async function songsByAlbum(id) {
  const key = decodeEntityId(id)
  const [artistKey, albumKey] = key.split('::')
  const [songs, likes] = await Promise.all([rawSongs(), likedIds()])
  return songs
    .filter(
      (song) =>
        (song.artistKey || normalizeLabel(song.artistName)) === artistKey &&
        (song.albumKey || normalizeLabel(song.albumTitle)) === albumKey,
    )
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((song) => viewSong(song, likes))
}

export async function listPlaylists() {
  await ensureDefaultPlaylists()
  const playlists = await getAll(STORES.playlists)
  return playlists
    .map((playlist) => ({
      ...playlist,
      track_count: playlist.entries?.length || 0,
      created_at: playlist.createdAt,
      updated_at: playlist.updatedAt,
    }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export async function createPlaylist(name) {
  const timestamp = nowIso()
  const playlist = {
    id: createId('playlist'),
    name: name.trim(),
    entries: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await putRecord(STORES.playlists, playlist)
  emitLibraryChanged({ type: 'playlist-created', playlistId: playlist.id })
  return { ...playlist, track_count: 0 }
}

export async function getPlaylist(id) {
  const playlist = await getRecord(STORES.playlists, id)
  if (!playlist) return null
  const [songs, likes] = await Promise.all([rawSongs(), likedIds()])
  const songsById = new Map(songs.map((song) => [song.id, song]))
  const entries = (playlist.entries || [])
    .map((entry, index) => {
      const song = songsById.get(entry.songId)
      if (!song) return null
      return {
        id: entry.id,
        order: index,
        added_at: entry.addedAt,
        song: viewSong(song, likes),
      }
    })
    .filter(Boolean)

  return {
    ...playlist,
    entries,
    track_count: entries.length,
    created_at: playlist.createdAt,
    updated_at: playlist.updatedAt,
  }
}

export async function renamePlaylist(id, name) {
  const playlist = await getRecord(STORES.playlists, id)
  if (!playlist) return null
  const updated = { ...playlist, name: name.trim() || playlist.name, updatedAt: nowIso() }
  await putRecord(STORES.playlists, updated)
  emitLibraryChanged({ type: 'playlist-updated', playlistId: id })
  return updated
}

export async function deletePlaylist(id) {
  await deleteRecord(STORES.playlists, id)
  emitLibraryChanged({ type: 'playlist-deleted', playlistId: id })
}

export async function addSongToPlaylist(playlistId, songId) {
  const playlist = await getRecord(STORES.playlists, playlistId)
  const song = await getRecord(STORES.songs, songId)
  if (!playlist || !song) return null
  const entries = playlist.entries || []
  if (entries.some((entry) => entry.songId === songId)) return getPlaylist(playlistId)
  const updated = {
    ...playlist,
    entries: [...entries, { id: createId('entry'), songId, addedAt: nowIso() }],
    updatedAt: nowIso(),
  }
  await putRecord(STORES.playlists, updated)
  emitLibraryChanged({ type: 'playlist-updated', playlistId })
  return getPlaylist(playlistId)
}

export async function removePlaylistEntry(playlistId, entryId) {
  const playlist = await getRecord(STORES.playlists, playlistId)
  if (!playlist) return
  const updated = {
    ...playlist,
    entries: (playlist.entries || []).filter((entry) => entry.id !== entryId),
    updatedAt: nowIso(),
  }
  await putRecord(STORES.playlists, updated)
  emitLibraryChanged({ type: 'playlist-updated', playlistId })
}

export async function reorderPlaylist(playlistId, entryIds) {
  const playlist = await getRecord(STORES.playlists, playlistId)
  if (!playlist) return null
  const entriesById = new Map((playlist.entries || []).map((entry) => [entry.id, entry]))
  const ordered = entryIds.map((entryId) => entriesById.get(entryId)).filter(Boolean)
  const missing = (playlist.entries || []).filter((entry) => !entryIds.includes(entry.id))
  const updated = { ...playlist, entries: [...ordered, ...missing], updatedAt: nowIso() }
  await putRecord(STORES.playlists, updated)
  emitLibraryChanged({ type: 'playlist-updated', playlistId })
  return getPlaylist(playlistId)
}

export async function listLikedSongs(sort = 'recent') {
  const [likes, songs] = await Promise.all([getAll(STORES.likes), rawSongs()])
  const likesBySong = new Map(likes.map((like) => [like.songId, like]))
  const result = songs
    .filter((song) => likesBySong.has(song.id))
    .map((song) => viewSong(song, new Set([song.id])))

  if (sort === 'title') return result.sort((a, b) => a.title.localeCompare(b.title))
  if (sort === 'artist') {
    return result.sort((a, b) => a.artist.name.localeCompare(b.artist.name) || a.title.localeCompare(b.title))
  }
  return result.sort((a, b) => {
    const likedA = likesBySong.get(a.id)?.createdAt || ''
    const likedB = likesBySong.get(b.id)?.createdAt || ''
    return String(likedB).localeCompare(String(likedA))
  })
}

export async function setLiked(songId, liked) {
  if (liked) {
    await putRecord(STORES.likes, { songId, createdAt: nowIso() })
  } else {
    await deleteRecord(STORES.likes, songId)
  }
  emitLibraryChanged({ type: liked ? 'song-liked' : 'song-unliked', songId })
}

export async function toggleLiked(songId) {
  const liked = await getRecord(STORES.likes, songId)
  await setLiked(songId, !liked)
  return !liked
}

export async function recordRecentlyPlayed(songId, positionSeconds = 0) {
  if (!songId) return
  await putRecord(STORES.recent, {
    songId,
    position_seconds: Math.floor(positionSeconds || 0),
    playedAt: nowIso(),
  })
}

export async function listRecentlyPlayed(limit = 25) {
  const [records, songs, likes] = await Promise.all([getAll(STORES.recent), rawSongs(), likedIds()])
  const songsById = new Map(songs.map((song) => [song.id, song]))
  return records
    .sort((a, b) => String(b.playedAt).localeCompare(String(a.playedAt)))
    .slice(0, limit)
    .map((record) => {
      const song = songsById.get(record.songId)
      return song ? { ...record, played_at: record.playedAt, song: viewSong(song, likes) } : null
    })
    .filter(Boolean)
}

export async function savePlaybackState(state) {
  if (!state?.song_id) return
  await putRecord(STORES.playback, {
    id: 'current',
    ...state,
    position_seconds: Math.floor(state.position_seconds || 0),
    updatedAt: nowIso(),
  })
}

export async function getPlaybackState() {
  const state = await getRecord(STORES.playback, 'current')
  if (!state?.song_id) return { song: null, position_seconds: 0 }
  const song = await getSong(state.song_id)
  return {
    ...state,
    song,
    updated_at: state.updatedAt,
  }
}

export async function getHomeData() {
  const [recentlyPlayed, likedSongs, playlists, songs, playback] = await Promise.all([
    listRecentlyPlayed(12),
    listLikedSongs('recent'),
    listPlaylists(),
    listSongs(),
    getPlaybackState(),
  ])
  const recentlyAdded = songs.slice(0, 12)
  const suggestions = [...songs].sort(() => Math.random() - 0.5).slice(0, 12)

  return {
    continue_listening: playback,
    recently_played: recentlyPlayed,
    liked_songs: likedSongs.slice(0, 12).map((song) => ({ song })),
    playlists: playlists.slice(0, 12),
    recently_added: recentlyAdded,
    suggestions,
  }
}

export async function searchLibrary(query) {
  const needle = normalizeLabel(query)
  if (!needle) return { songs: [], artists: [], albums: [], playlists: [] }
  const [songs, artists, albums, playlists] = await Promise.all([
    listSongs(),
    listArtists(),
    listAlbums(),
    listPlaylists(),
  ])
  const matches = (...values) => values.some((value) => normalizeLabel(value).includes(needle))

  return {
    songs: songs.filter((song) => matches(song.title, song.artist?.name, song.album?.title)).slice(0, 20),
    artists: artists.filter((artist) => matches(artist.name)).slice(0, 20),
    albums: albums.filter((album) => matches(album.title, album.artist?.name)).slice(0, 20),
    playlists: playlists.filter((playlist) => matches(playlist.name)).slice(0, 20),
  }
}

function storageError(error) {
  if (error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return new Error('This device does not have enough browser storage for that music file.')
  }
  return error
}

export async function importSongs(files, form = {}) {
  await requestPersistentStorage()
  const selectedFiles = Array.from(files || []).filter(isAudioFile)
  if (!selectedFiles.length) throw new Error('Choose at least one supported audio file.')

  const imported = []
  for (const file of selectedFiles) {
    const metadata = await readAudioMetadata(file)
    const singleFile = selectedFiles.length === 1
    const title = (singleFile ? form.title : '') || metadata.title || file.name
    const artistName = (singleFile ? form.artist_name : '') || metadata.artist || 'Unknown Artist'
    const albumTitle = metadata.album || ''
    const releaseYear = (singleFile ? form.release_year : '') || metadata.year || ''
    const timestamp = nowIso()
    const song = {
      id: createId('song'),
      title: title.trim(),
      artistName: artistName.trim() || 'Unknown Artist',
      artistKey: normalizeLabel(artistName || 'Unknown Artist'),
      albumTitle: albumTitle.trim(),
      albumKey: normalizeLabel(albumTitle),
      release_year: releaseYear ? Number(releaseYear) || null : null,
      duration_seconds: metadata.duration_seconds || 0,
      artworkDataUrl: metadata.artworkDataUrl || '',
      original_filename: file.name,
      audioBlob: file,
      size: file.size,
      type: file.type,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    try {
      await putRecord(STORES.songs, song)
      imported.push(song)
    } catch (error) {
      throw storageError(error)
    }
  }

  emitLibraryChanged({ type: 'songs-imported', songIds: imported.map((song) => song.id) })
  return imported
}

export async function updateSong(songId, values = {}, replacementFile = null) {
  const existing = await getRecord(STORES.songs, songId)
  if (!existing) throw new Error('Song not found.')

  let fileData = {}
  if (replacementFile) {
    const metadata = await readAudioMetadata(replacementFile)
    fileData = {
      audioBlob: replacementFile,
      original_filename: replacementFile.name,
      size: replacementFile.size,
      type: replacementFile.type,
      duration_seconds: metadata.duration_seconds || existing.duration_seconds || 0,
      artworkDataUrl: metadata.artworkDataUrl || existing.artworkDataUrl || '',
    }
  }

  const artistName = (values.artist_name || existing.artistName || 'Unknown Artist').trim()
  const albumTitle = (values.album_title ?? existing.albumTitle ?? '').trim()
  const updated = {
    ...existing,
    ...fileData,
    title: (values.title || existing.title).trim(),
    artistName,
    artistKey: normalizeLabel(artistName),
    albumTitle,
    albumKey: normalizeLabel(albumTitle),
    release_year: values.release_year ? Number(values.release_year) || null : existing.release_year || null,
    updatedAt: nowIso(),
  }
  await putRecord(STORES.songs, updated)
  emitLibraryChanged({ type: 'song-updated', songId })
  return viewSong(updated, await likedIds())
}

export async function deleteSong(songId) {
  await deleteRecord(STORES.songs, songId)
  await deleteRecord(STORES.likes, songId)
  await deleteRecord(STORES.recent, songId)

  const playback = await getRecord(STORES.playback, 'current')
  if (playback?.song_id === songId) await deleteRecord(STORES.playback, 'current')

  const playlists = await getAll(STORES.playlists)
  for (const playlist of playlists) {
    const entries = (playlist.entries || []).filter((entry) => entry.songId !== songId)
    if (entries.length !== (playlist.entries || []).length) {
      await putRecord(STORES.playlists, { ...playlist, entries, updatedAt: nowIso() })
    }
  }

  emitLibraryChanged({ type: 'song-deleted', songId })
}

export async function clearMusicLibrary() {
  await clearStore(STORES.songs)
  await clearStore(STORES.likes)
  await clearStore(STORES.recent)
  await clearStore(STORES.playback)

  const playlists = await getAll(STORES.playlists)
  for (const playlist of playlists) {
    await putRecord(STORES.playlists, { ...playlist, entries: [], updatedAt: nowIso() })
  }

  emitLibraryChanged({ type: 'library-cleared' })
}

export async function storageStats() {
  const songs = await rawSongs()
  const estimate = navigator.storage?.estimate ? await navigator.storage.estimate().catch(() => null) : null
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted().catch(() => false) : false
  return {
    count: songs.length,
    bytes: songs.reduce((total, song) => total + (song.size || song.audioBlob?.size || 0), 0),
    usage: estimate?.usage || 0,
    quota: estimate?.quota || 0,
    persisted,
  }
}

export async function resolveAudioSource(song) {
  const record = await getRecord(STORES.songs, song.id)
  if (!record?.audioBlob) throw new Error('This song is no longer stored on this device.')
  return {
    url: URL.createObjectURL(record.audioBlob),
    revoke: true,
    offline: true,
  }
}

export async function allSongsAvailableOfflineIds() {
  const songs = await rawSongs()
  return new Set(songs.map((song) => song.id))
}

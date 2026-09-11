import { Database, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import SongRow from '../components/SongRow'
import { usePlayer } from '../context/PlayerContext'
import {
  clearMusicLibrary,
  deleteSong,
  LIBRARY_CHANGED_EVENT,
  listSongs,
  storageStats,
} from '../services/localLibrary'
import { formatStorage } from '../utils/format'

export default function DownloadsPage() {
  const player = usePlayer()
  const [songs, setSongs] = useState([])
  const [stats, setStats] = useState({ count: 0, bytes: 0, usage: 0, quota: 0, persisted: false })
  const [error, setError] = useState('')

  async function load() {
    const [songData, currentStats] = await Promise.all([listSongs(), storageStats()])
    setSongs(songData)
    setStats(currentStats)
  }

  useEffect(() => {
    load().catch((err) => setError(err.message || 'Could not load storage.'))
    window.addEventListener(LIBRARY_CHANGED_EVENT, load)
    return () => window.removeEventListener(LIBRARY_CHANGED_EVENT, load)
  }, [])

  async function clearAll() {
    if (!confirm('Clear all local music from this device?')) return
    await clearMusicLibrary()
    load()
  }

  async function removeSong(song) {
    if (!confirm(`Delete "${song.title}" from this device?`)) return
    await deleteSong(song.id)
    load()
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Device storage</p>
          <h1>Storage</h1>
          <p>Local music: {stats.count} songs • {formatStorage(stats.bytes)}</p>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={() => songs[0] && player.playContext(songs, songs[0].id, { type: 'storage', label: 'Storage' })}>Play</button>
          <button className="text-button danger-text" type="button" onClick={clearAll} disabled={!songs.length}><Trash2 size={16} /> Clear</button>
        </div>
      </header>
      {error && <p className="form-error">{error}</p>}
      <section className="section">
        <div className="storage-summary">
          <Database size={20} />
          <strong>{formatStorage(stats.usage || stats.bytes)} used{stats.quota ? ` of ${formatStorage(stats.quota)}` : ''}</strong>
          <span>{stats.persisted ? 'Persistent browser storage granted' : 'Storage can be limited by iOS/browser settings'}</span>
        </div>
      </section>
      {!songs.length && <div className="empty-state"><h2>No local music</h2><p>Use Add Music to import songs on this device.</p></div>}
      <div className="song-list">
        {songs.map((song, index) => (
          <SongRow
            key={song.id}
            song={song}
            tracks={songs}
            context={{ type: 'storage', label: 'Storage' }}
            index={index}
            onRemove={() => removeSong(song)}
            onLikeChange={load}
          />
        ))}
      </div>
    </div>
  )
}

import {
  CheckCircle2,
  Database,
  Disc3,
  FileAudio,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  clearMusicLibrary,
  deleteSong as deleteLocalSong,
  importSongs,
  listArtists,
  listSongs,
  storageStats,
  updateSong,
} from '../services/localLibrary'
import { formatDuration, formatStorage } from '../utils/format'

const emptySongForm = {
  title: '',
  artist_name: '',
}

const tabs = [
  { id: 'import', label: 'Add Music', icon: Upload },
  { id: 'songs', label: 'Songs', icon: Disc3 },
  { id: 'storage', label: 'Storage', icon: Database },
]

export default function AddMusicPage() {
  const [activeTab, setActiveTab] = useState('import')
  const [songs, setSongs] = useState([])
  const [artists, setArtists] = useState([])
  const [stats, setStats] = useState({ count: 0, bytes: 0, usage: 0, quota: 0, persisted: false })
  const [songFiles, setSongFiles] = useState([])
  const [songForm, setSongForm] = useState(emptySongForm)
  const [editingSong, setEditingSong] = useState(null)
  const [replaceFile, setReplaceFile] = useState(null)
  const [songQuery, setSongQuery] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const filteredSongs = useMemo(() => {
    const query = songQuery.trim().toLowerCase()
    if (!query) return songs
    return songs.filter((song) =>
      [song.title, song.artist?.name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    )
  }, [songQuery, songs])

  async function load() {
    setLoading(true)
    try {
      const [songData, artistData, currentStats] = await Promise.all([
        listSongs(),
        listArtists(),
        storageStats(),
      ])
      setSongs(songData)
      setArtists(artistData)
      setStats(currentStats)
      setError('')
    } catch (err) {
      setError(err.message || 'Could not load local library.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function notify(text) {
    setMessage(text)
    window.setTimeout(() => setMessage(''), 3500)
  }

  function clearNotices() {
    setError('')
    setMessage('')
  }

  async function importSelectedSongs(event) {
    event.preventDefault()
    if (!songFiles.length) return
    if (songFiles.length === 1 && (!songForm.title.trim() || !songForm.artist_name.trim())) {
      setError('Song title and artist are required for single-song import.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const imported = await importSongs(songFiles, songForm)
      setSongFiles([])
      setSongForm(emptySongForm)
      notify(`${imported.length} song${imported.length === 1 ? '' : 's'} imported.`)
      await load()
    } catch (err) {
      setError(err.message || 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  async function saveEditingSong(event) {
    event.preventDefault()
    if (!editingSong) return
    setBusy(true)
    setError('')
    try {
      await updateSong(editingSong.id, editingSong, replaceFile)
      setEditingSong(null)
      setReplaceFile(null)
      notify('Song saved.')
      await load()
    } catch (err) {
      setError(err.message || 'Could not save song.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteSong(song) {
    if (!confirm(`Delete song "${song.title}" from this device?`)) return
    setError('')
    try {
      await deleteLocalSong(song.id)
      notify('Song deleted.')
      await load()
    } catch (err) {
      setError(err.message || 'Could not delete song.')
    }
  }

  async function clearLibrary() {
    if (!confirm('Clear all local music from this device? Playlists will remain but their songs will be removed.')) return
    setBusy(true)
    setError('')
    try {
      await clearMusicLibrary()
      notify('Local music library cleared.')
      await load()
    } catch (err) {
      setError(err.message || 'Could not clear local music.')
    } finally {
      setBusy(false)
    }
  }

  function startEditing(song) {
    setActiveTab('songs')
    setReplaceFile(null)
    setEditingSong({
      id: song.id,
      title: song.title,
      artist_name: song.artist?.name || '',
    })
  }

  return (
    <div className="page admin-page">
      <header className="admin-hero">
        <div>
          <p className="eyebrow">Local device library</p>
          <h1>Add Music</h1>
          <p>Import songs from this device. Music is stored locally and works offline.</p>
        </div>
        <button className="text-button" type="button" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} Refresh
        </button>
      </header>

      <section className="admin-stats">
        <StatCard icon={Disc3} label="Songs" value={songs.length} />
        <StatCard icon={Users} label="Artists" value={artists.length} />
        <StatCard icon={Database} label="Local Music" value={formatStorage(stats.bytes)} />
      </section>

      {(message || error) && (
        <div className={`admin-alert ${error ? 'admin-alert--error' : ''}`}>
          {error ? <X size={18} /> : <CheckCircle2 size={18} />}
          <span>{error || message}</span>
          <button type="button" className="icon-button" onClick={clearNotices} title="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      <nav className="admin-tabs" aria-label="Library sections">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              className={activeTab === tab.id ? 'is-active' : ''}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              key={tab.id}
            >
              <Icon size={17} /> {tab.label}
            </button>
          )
        })}
      </nav>

      {activeTab === 'import' && (
        <section className="admin-grid admin-grid--single">
          <form className="admin-panel admin-panel--primary" onSubmit={importSelectedSongs}>
            <PanelTitle icon={Upload} title="Import Songs" detail="Choose one or more audio files from this device." />
            <FilePicker
              label="Choose audio files"
              files={songFiles}
              multiple
              onChange={(files) => setSongFiles(files)}
            />
            {songFiles.length <= 1 && <SongMetadataFields form={songForm} setForm={setSongForm} />}
            {songFiles.length > 1 && (
              <div className="admin-help-list">
                <span>Multiple files will use embedded metadata or filename fallback.</span>
                <span>Edit titles and artists after import if needed.</span>
              </div>
            )}
            <button className="primary-button" type="submit" disabled={busy || !songFiles.length}>
              {busy ? <Loader2 className="spin" size={17} /> : <Upload size={17} />} Import
            </button>
          </form>

          <aside className="admin-panel admin-help-panel">
            <PanelTitle icon={FileAudio} title="Offline by Default" detail="Imported music never uploads to a server." />
            <div className="admin-help-list">
              <span>Supported: MP3, M4A, AAC, WAV when the browser can play them.</span>
              <span>Duration is read locally from the audio file.</span>
              <span>Embedded tags and artwork are used automatically when available.</span>
              <span>Each phone keeps a separate library.</span>
            </div>
          </aside>
        </section>
      )}

      {activeTab === 'songs' && (
        <section className="admin-songs-layout">
          <div className="admin-panel">
            <PanelTitle icon={Disc3} title="Manage Songs" detail="Edit metadata or delete songs stored on this device." />
            <div className="admin-search">
              <Search size={18} />
              <input
                value={songQuery}
                onChange={(event) => setSongQuery(event.target.value)}
                placeholder="Search songs or artists"
              />
            </div>
            <div className="admin-song-list">
              {filteredSongs.map((song) => (
                <div className="admin-song" key={song.id}>
                  <div className="admin-song__title">
                    <strong>{song.title}</strong>
                    <span>{song.artist?.name || 'Unknown Artist'}</span>
                  </div>
                  <span className="admin-song__duration">{formatDuration(song.duration_seconds)}</span>
                  <button className="text-button" type="button" onClick={() => startEditing(song)}>
                    <Pencil size={16} /> Edit
                  </button>
                  <button className="icon-button danger" type="button" onClick={() => deleteSong(song)} title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {!filteredSongs.length && (
                <div className="empty-state admin-empty">
                  <Disc3 size={30} />
                  <h2>No songs found</h2>
                </div>
              )}
            </div>
          </div>

          <form className="admin-panel edit-panel" onSubmit={saveEditingSong}>
            <PanelTitle icon={Pencil} title="Edit Song" detail="Select a song from the list to update it." />
            {editingSong ? (
              <>
                <SongMetadataFields form={editingSong} setForm={setEditingSong} />
                <FilePicker
                  label="Replace audio file"
                  files={replaceFile ? [replaceFile] : []}
                  optional
                  onChange={(files) => setReplaceFile(files?.[0] || null)}
                />
                <div className="header-actions">
                  <button className="primary-button" type="submit" disabled={busy}>
                    {busy ? <Loader2 className="spin" size={17} /> : <CheckCircle2 size={17} />} Save
                  </button>
                  <button className="text-button" type="button" onClick={() => setEditingSong(null)}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="admin-empty">
                <Pencil size={28} />
                <p>Choose Edit on any song.</p>
              </div>
            )}
          </form>
        </section>
      )}

      {activeTab === 'storage' && (
        <section className="admin-grid admin-grid--single">
          <div className="admin-panel">
            <PanelTitle icon={Database} title="Storage" detail="Manage music stored in this browser on this device." />
            <div className="storage-summary">
              <strong>{stats.count} songs • {formatStorage(stats.bytes)}</strong>
              <span>
                Browser usage: {formatStorage(stats.usage || stats.bytes)}
                {stats.quota ? ` of ${formatStorage(stats.quota)}` : ''}
              </span>
              <span>{stats.persisted ? 'Persistent storage granted' : 'Browser may reclaim storage if the device is low on space'}</span>
            </div>
            <button className="primary-button danger-button" type="button" onClick={clearLibrary} disabled={busy || !songs.length}>
              <Trash2 size={17} /> Clear Local Music
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="admin-stat-card">
      <Icon size={20} />
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

function PanelTitle({ icon: Icon, title, detail }) {
  return (
    <div className="panel-title">
      <span><Icon size={18} /></span>
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </div>
  )
}

function FilePicker({ label, files = [], optional = false, multiple = false, onChange }) {
  const detail = files.length
    ? files.length === 1
      ? `${files[0].name} • ${formatStorage(files[0].size)}`
      : `${files.length} files selected`
    : optional
      ? 'Optional replacement file'
      : 'MP3, M4A, AAC, or WAV'

  return (
    <label className="file-picker">
      <input
        type="file"
        accept=".mp3,.m4a,.aac,.wav,audio/*"
        multiple={multiple}
        onChange={(event) => onChange?.(Array.from(event.target.files || []))}
      />
      <span className="file-picker__icon"><FileAudio size={22} /></span>
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
    </label>
  )
}

function SongMetadataFields({ form, setForm }) {
  function update(key, value) {
    setForm({ ...form, [key]: value })
  }

  return (
    <div className="metadata-fields">
      <label>
        Title
        <input value={form.title || ''} onChange={(event) => update('title', event.target.value)} placeholder="Song title" required />
      </label>
      <label>
        Artist
        <input value={form.artist_name || ''} onChange={(event) => update('artist_name', event.target.value)} placeholder="Artist" required />
      </label>
    </div>
  )
}

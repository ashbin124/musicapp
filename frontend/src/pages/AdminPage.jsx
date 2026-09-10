import {
  CheckCircle2,
  Disc3,
  FileAudio,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api, getErrorMessage } from '../api/client'
import { collection } from '../utils/apiData'
import { formatDuration, formatStorage } from '../utils/format'

const emptySongForm = {
  title: '',
  artist_name: '',
  release_year: '',
}

const tabs = [
  { id: 'upload', label: 'Upload Song', icon: Upload },
  { id: 'songs', label: 'Songs', icon: Disc3 },
  { id: 'catalog', label: 'Artists', icon: Users },
]

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('upload')
  const [songs, setSongs] = useState([])
  const [artists, setArtists] = useState([])
  const [songFile, setSongFile] = useState(null)
  const [songForm, setSongForm] = useState(emptySongForm)
  const [editingSong, setEditingSong] = useState(null)
  const [replaceFile, setReplaceFile] = useState(null)
  const [artistName, setArtistName] = useState('')
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
      const [songRes, artistRes] = await Promise.all([
        api.get('/songs/'),
        api.get('/artists/'),
      ])
      setSongs(collection(songRes.data))
      setArtists(collection(artistRes.data))
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load admin data.'))
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

  async function uploadSong(event) {
    event.preventDefault()
    if (!songFile) return
    setBusy(true)
    setError('')
    try {
      const data = new FormData()
      data.append('audio_file', songFile)
      Object.entries(songForm).forEach(([key, value]) => {
        if (value) data.append(key, value)
      })
      await api.post('/songs/', data)
      setSongFile(null)
      setSongForm(emptySongForm)
      notify('Song uploaded.')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed.'))
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
      const data = new FormData()
      data.append('title', editingSong.title)
      data.append('artist_name', editingSong.artist_name)
      if (editingSong.release_year) data.append('release_year', editingSong.release_year)
      if (replaceFile) data.append('audio_file', replaceFile)
      await api.patch(`/songs/${editingSong.id}/`, data)
      setEditingSong(null)
      setReplaceFile(null)
      notify('Song saved.')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save song.'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteSong(song) {
    if (!confirm(`Delete song "${song.title}"?`)) return
    setError('')
    try {
      await api.delete(`/songs/${song.id}/`)
      notify('Song deleted.')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete song.'))
    }
  }

  async function createArtist(event) {
    event.preventDefault()
    if (!artistName.trim()) return
    setError('')
    try {
      await api.post('/artists/', { name: artistName.trim() })
      setArtistName('')
      notify('Artist created.')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create artist.'))
    }
  }

  async function deleteArtist(artist) {
    if (!confirm(`Delete artist "${artist.name}"?`)) return
    setError('')
    try {
      await api.delete(`/artists/${artist.id}/`)
      notify('Artist deleted.')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Delete that artist after deleting or editing their songs.'))
    }
  }

  function startEditing(song) {
    setActiveTab('songs')
    setReplaceFile(null)
    setEditingSong({
      id: song.id,
      title: song.title,
      artist_name: song.artist?.name || '',
      release_year: song.release_year || '',
    })
  }

  return (
    <div className="page admin-page">
      <header className="admin-hero">
        <div>
          <p className="eyebrow">Protected library controls</p>
          <h1>Music Admin</h1>
          <p>Add song title and artist manually, manage tracks, and delete artists.</p>
        </div>
        <button className="text-button" type="button" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} Refresh
        </button>
      </header>

      <section className="admin-stats">
        <StatCard icon={Disc3} label="Songs" value={songs.length} />
        <StatCard icon={Users} label="Artists" value={artists.length} />
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

      <nav className="admin-tabs" aria-label="Admin sections">
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

      {activeTab === 'upload' && (
        <section className="admin-grid admin-grid--single">
          <form className="admin-panel admin-panel--primary" onSubmit={uploadSong}>
            <PanelTitle icon={Upload} title="Upload Song" detail="Choose an audio file and enter every visible detail manually." />
            <FilePicker
              label="Choose audio file"
              file={songFile}
              onChange={(files) => setSongFile(files?.[0] || null)}
            />
            <SongMetadataFields form={songForm} setForm={setSongForm} />
            <button className="primary-button" type="submit" disabled={busy || !songFile}>
              {busy ? <Loader2 className="spin" size={17} /> : <Upload size={17} />} Save Song
            </button>
          </form>

          <aside className="admin-panel admin-help-panel">
            <PanelTitle icon={FileAudio} title="Manual Entry" detail="This screen does not auto-fill song title, artist, or year." />
            <div className="admin-help-list">
              <span>Required: audio file, song title, artist</span>
              <span>Optional: release year</span>
              <span>Duration is still read from the audio file for the player timer.</span>
              <span>Embedded artwork may still be used when the file has cover art.</span>
            </div>
          </aside>
        </section>
      )}

      {activeTab === 'songs' && (
        <section className="admin-songs-layout">
          <div className="admin-panel">
            <PanelTitle icon={Disc3} title="Manage Songs" detail="Edit metadata, replace files, or delete tracks." />
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
                  file={replaceFile}
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

      {activeTab === 'catalog' && (
        <section className="admin-grid admin-grid--artists">
          <form className="admin-panel" onSubmit={createArtist}>
            <PanelTitle icon={Users} title="Artists" detail="Create or delete artist records." />
            <div className="inline-form">
              <input value={artistName} onChange={(event) => setArtistName(event.target.value)} placeholder="Artist name" />
              <button className="primary-button" type="submit"><Plus size={17} /> Create</button>
            </div>
            <CatalogList
              items={artists}
              getTitle={(artist) => artist.name}
              getSubtitle={(artist) => `${artist.song_count || 0} songs`}
              onDelete={deleteArtist}
              emptyLabel="No artists yet"
            />
          </form>
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

function FilePicker({ label, file, optional = false, onChange }) {
  return (
    <label className="file-picker">
      <input
        type="file"
        accept=".mp3,.m4a,.aac,.wav,audio/*"
        onChange={(event) => onChange?.(Array.from(event.target.files || []))}
      />
      <span className="file-picker__icon"><FileAudio size={22} /></span>
      <span>
        <strong>{file ? file.name : label}</strong>
        <small>{file ? formatStorage(file.size) : optional ? 'Optional replacement file' : 'MP3, M4A, AAC, or WAV'}</small>
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
      <label>
        Year
        <input value={form.release_year || ''} onChange={(event) => update('release_year', event.target.value)} placeholder="Optional" inputMode="numeric" />
      </label>
    </div>
  )
}

function CatalogList({ items, getTitle, getSubtitle, onDelete, emptyLabel }) {
  if (!items.length) {
    return <div className="admin-empty">{emptyLabel}</div>
  }

  return (
    <div className="catalog-list">
      {items.map((item) => (
        <div className="catalog-item" key={item.id}>
          <div>
            <strong>{getTitle(item)}</strong>
            <span>{getSubtitle(item)}</span>
          </div>
          <button className="icon-button danger" type="button" onClick={() => onDelete(item)} title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}

import { Download, Shuffle, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { api, getErrorMessage } from '../api/client'
import SongRow from '../components/SongRow'
import { usePlayer } from '../context/PlayerContext'
import { downloadSong, getDownloadedIds } from '../services/offlineAudio'
import { collection, shuffleCopy } from '../utils/apiData'

export default function PlaylistPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const outlet = useOutletContext()
  const player = usePlayer()
  const [playlist, setPlaylist] = useState(null)
  const [allSongs, setAllSongs] = useState([])
  const [selectedSong, setSelectedSong] = useState('')
  const [downloadedIds, setDownloadedIds] = useState(new Set())
  const [dragIndex, setDragIndex] = useState(null)
  const [error, setError] = useState('')
  const songs = useMemo(() => playlist?.entries.map((entry) => entry.song) || [], [playlist])

  async function load() {
    try {
      const [playlistRes, songsRes, ids] = await Promise.all([
        api.get(`/playlists/${id}/`),
        api.get('/songs/'),
        getDownloadedIds(),
      ])
      setPlaylist(playlistRes.data)
      setAllSongs(collection(songsRes.data))
      setDownloadedIds(ids)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load playlist.'))
    }
  }

  useEffect(() => {
    load()
  }, [id])

  async function rename(name) {
    const response = await api.patch(`/playlists/${id}/`, { name })
    setPlaylist((current) => ({ ...current, ...response.data }))
    outlet?.refreshPlaylists?.()
  }

  async function addSong(event) {
    event.preventDefault()
    if (!selectedSong) return
    await api.post(`/playlists/${id}/add_song/`, { song_id: Number(selectedSong) })
    setSelectedSong('')
    load()
  }

  async function removeEntry(entryId) {
    await api.delete(`/playlists/${id}/entries/${entryId}/`)
    load()
  }

  async function reorder(from, to) {
    if (from === to || from === null) return
    const entries = [...playlist.entries]
    const [moved] = entries.splice(from, 1)
    entries.splice(to, 0, moved)
    setPlaylist({ ...playlist, entries })
    await api.post(`/playlists/${id}/reorder/`, { entry_ids: entries.map((entry) => entry.id) })
  }

  async function deletePlaylist() {
    if (!confirm(`Delete ${playlist.name}?`)) return
    await api.delete(`/playlists/${id}/`)
    outlet?.refreshPlaylists?.()
    navigate('/library')
  }

  async function downloadPlaylist() {
    setError('')
    try {
      for (const song of songs) await downloadSong(song)
      await load()
    } catch (err) {
      setError(err.message || 'Download failed.')
    }
  }

  if (!playlist) return <div className="page"><div className="loading-block">Loading</div></div>

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Playlist</p>
          <input
            className="title-input"
            value={playlist.name}
            onChange={(event) => setPlaylist({ ...playlist, name: event.target.value })}
            onBlur={(event) => rename(event.target.value)}
          />
          <p>{playlist.entries.length} tracks</p>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={() => songs[0] && player.playContext(songs, songs[0].id, { type: 'playlist', id, label: playlist.name })}>
            Play
          </button>
          <button className="text-button" type="button" onClick={() => {
            const shuffled = shuffleCopy(songs)
            if (shuffled[0]) player.playContext(shuffled, shuffled[0].id, { type: 'playlist', id, label: playlist.name })
          }}>
            <Shuffle size={16} /> Shuffle
          </button>
          <button className="text-button" type="button" onClick={downloadPlaylist}>
            <Download size={16} /> Download
          </button>
          <button className="icon-button danger" type="button" onClick={deletePlaylist} title="Delete playlist">
            <Trash2 size={18} />
          </button>
        </div>
      </header>
      {error && <p className="form-error">{error}</p>}
      <form className="inline-form" onSubmit={addSong}>
        <select value={selectedSong} onChange={(event) => setSelectedSong(event.target.value)}>
          <option value="">Add song</option>
          {allSongs.map((song) => (
            <option value={song.id} key={song.id}>
              {song.title} - {song.artist?.name}
            </option>
          ))}
        </select>
        <button className="primary-button" type="submit">Add</button>
      </form>
      <div className="song-list">
        {playlist.entries.map((entry, index) => (
          <SongRow
            key={entry.id}
            song={entry.song}
            tracks={songs}
            context={{ type: 'playlist', id, label: playlist.name }}
            index={index}
            downloaded={downloadedIds.has(entry.song.id)}
            onDownloadChange={load}
            onRemove={() => removeEntry(entry.id)}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => reorder(dragIndex, index)}
          />
        ))}
      </div>
    </div>
  )
}

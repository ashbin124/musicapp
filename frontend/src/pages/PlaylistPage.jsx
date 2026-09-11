import { Shuffle, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import SongRow from '../components/SongRow'
import { usePlayer } from '../context/PlayerContext'
import {
  addSongToPlaylist,
  deletePlaylist as deleteLocalPlaylist,
  getPlaylist,
  LIBRARY_CHANGED_EVENT,
  listSongs,
  removePlaylistEntry,
  renamePlaylist,
  reorderPlaylist,
} from '../services/localLibrary'
import { shuffleCopy } from '../utils/arrays'

export default function PlaylistPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const outlet = useOutletContext()
  const player = usePlayer()
  const [playlist, setPlaylist] = useState(null)
  const [allSongs, setAllSongs] = useState([])
  const [selectedSong, setSelectedSong] = useState('')
  const [dragIndex, setDragIndex] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const songs = useMemo(() => playlist?.entries.map((entry) => entry.song) || [], [playlist])

  async function load() {
    setLoading(true)
    try {
      const [playlistData, songData] = await Promise.all([
        getPlaylist(id),
        listSongs(),
      ])
      setPlaylist(playlistData)
      setAllSongs(songData)
      setError('')
    } catch (err) {
      setError(err.message || 'Could not load playlist.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    window.addEventListener(LIBRARY_CHANGED_EVENT, load)
    return () => window.removeEventListener(LIBRARY_CHANGED_EVENT, load)
  }, [id])

  async function rename(name) {
    const updated = await renamePlaylist(id, name)
    setPlaylist((current) => ({ ...current, ...updated }))
    outlet?.refreshPlaylists?.()
  }

  async function addSong(event) {
    event.preventDefault()
    if (!selectedSong) return
    await addSongToPlaylist(id, selectedSong)
    setSelectedSong('')
    load()
  }

  async function removeEntry(entryId) {
    await removePlaylistEntry(id, entryId)
    load()
  }

  async function reorder(from, to) {
    if (from === to || from === null) return
    const entries = [...playlist.entries]
    const [moved] = entries.splice(from, 1)
    entries.splice(to, 0, moved)
    setPlaylist({ ...playlist, entries })
    await reorderPlaylist(id, entries.map((entry) => entry.id))
  }

  async function deletePlaylist() {
    if (!confirm(`Delete ${playlist.name}?`)) return
    await deleteLocalPlaylist(id)
    outlet?.refreshPlaylists?.()
    navigate('/library')
  }

  if (loading) return <div className="page"><div className="loading-block">Loading</div></div>
  if (!playlist) return <div className="page"><div className="empty-state"><h2>Playlist not found</h2></div></div>

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
            onLikeChange={load}
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

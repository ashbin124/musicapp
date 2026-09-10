import {
  Download,
  Heart,
  ListPlus,
  Pause,
  Play,
  Plus,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { api, getErrorMessage } from '../api/client'
import { usePlayer } from '../context/PlayerContext'
import { downloadSong, removeDownload } from '../services/offlineAudio'
import { formatDuration } from '../utils/format'
import Artwork from './Artwork'

export default function SongRow({
  song,
  tracks = [song],
  context,
  index,
  onDownloadChange,
  onRemove,
  downloaded = false,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
}) {
  const player = usePlayer()
  const [liked, setLiked] = useState(Boolean(song.liked))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isCurrent = player.currentTrack?.id === song.id

  async function toggleLike() {
    setError('')
    setBusy(true)
    try {
      if (liked) {
        await api.delete(`/songs/${song.id}/unlike/`)
        setLiked(false)
      } else {
        await api.post(`/songs/${song.id}/like/`)
        setLiked(true)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update liked songs.'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleDownload() {
    setError('')
    setBusy(true)
    try {
      if (downloaded) {
        await removeDownload(song.id)
      } else {
        await downloadSong(song)
      }
      onDownloadChange?.()
    } catch (err) {
      setError(err.message || 'Download failed.')
    } finally {
      setBusy(false)
    }
  }

  function play() {
    if (isCurrent) {
      player.playPause()
      return
    }
    player.playContext(tracks, song.id, context || { type: 'songs', label: 'Library' })
  }

  return (
    <div
      className={`song-row ${isCurrent ? 'is-current' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <button className="icon-button" type="button" onClick={play} title={isCurrent && player.isPlaying ? 'Pause' : 'Play'}>
        {isCurrent && player.isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>
      {typeof index === 'number' && <span className="song-row__index">{index + 1}</span>}
      <Artwork imageUrl={song.artwork_url} title={song.title} compact />
      <div className="song-row__meta">
        <strong>{song.title}</strong>
        <span>
          {song.artist?.name || 'Unknown Artist'}
          {song.album?.title ? ` • ${song.album.title}` : ''}
        </span>
        {error && <small className="inline-error">{error}</small>}
      </div>
      <span className="song-row__duration">{formatDuration(song.duration_seconds)}</span>
      <div className="song-row__actions">
        <button
          className={`icon-button ${liked ? 'is-liked' : ''}`}
          type="button"
          onClick={toggleLike}
          disabled={busy}
          title={liked ? 'Unlike' : 'Like'}
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <button className="icon-button" type="button" onClick={() => player.playNext(song)} title="Play next">
          <ListPlus size={18} />
        </button>
        <button className="icon-button" type="button" onClick={() => player.addToQueue(song)} title="Add to queue">
          <Plus size={18} />
        </button>
        <button
          className={`icon-button ${downloaded ? 'is-downloaded' : ''}`}
          type="button"
          onClick={toggleDownload}
          disabled={busy || !song.audio_url}
          title={downloaded ? 'Remove download' : 'Download'}
        >
          <Download size={18} />
        </button>
        {onRemove && (
          <button className="icon-button danger" type="button" onClick={onRemove} title="Remove">
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  )
}

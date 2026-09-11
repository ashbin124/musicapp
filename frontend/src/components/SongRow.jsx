import {
  Heart,
  ListPlus,
  Pause,
  Play,
  Plus,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { setLiked as saveLiked } from '../services/localLibrary'
import { formatDuration } from '../utils/format'
import Artwork from './Artwork'

export default function SongRow({
  song,
  tracks = [song],
  context,
  index,
  onLikeChange,
  onRemove,
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

  useEffect(() => {
    setLiked(Boolean(song.liked))
  }, [song.id, song.liked])

  async function toggleLike() {
    setError('')
    setBusy(true)
    try {
      await saveLiked(song.id, !liked)
      setLiked(!liked)
      onLikeChange?.()
    } catch (err) {
      setError(err.message || 'Could not update liked songs.')
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
        <span className="offline-chip">Offline</span>
        {onRemove && (
          <button className="icon-button danger" type="button" onClick={onRemove} title="Remove">
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  )
}

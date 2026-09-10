import {
  ArrowDown,
  ArrowUp,
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { usePlayer } from '../context/PlayerContext'
import { formatDuration } from '../utils/format'
import Artwork from './Artwork'

export default function PlayerBar() {
  const player = usePlayer()
  const [queueOpen, setQueueOpen] = useState(false)
  const [liked, setLiked] = useState(false)
  const track = player.currentTrack

  useEffect(() => {
    setLiked(Boolean(track?.liked))
  }, [track?.id, track?.liked])

  async function toggleLike() {
    if (!track) return
    if (liked || track.liked) {
      await api.delete(`/songs/${track.id}/unlike/`)
      setLiked(false)
    } else {
      await api.post(`/songs/${track.id}/like/`)
      setLiked(true)
    }
  }

  const progressMax = Math.max(player.duration || track?.duration_seconds || 0, 1)

  return (
    <>
      <div className={`mini-player ${track ? 'is-visible' : ''}`}>
        {track && (
          <Link to="/now-playing" className="mini-player__track">
            <Artwork imageUrl={track.artwork_url} title={track.title} compact />
            <span>
              <strong>{track.title}</strong>
              <small>{track.artist?.name}</small>
            </span>
          </Link>
        )}
        <button className="icon-button" type="button" onClick={player.playPause} title={player.isPlaying ? 'Pause' : 'Play'}>
          {player.isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
      </div>

      <footer className="player-bar">
        <div className="player-track">
          {track ? <Artwork imageUrl={track.artwork_url} title={track.title} compact /> : <div className="artwork artwork--compact" />}
          <div>
            <strong>{track?.title || 'No song selected'}</strong>
            <span>{track?.artist?.name || 'Choose a track'}</span>
          </div>
          <button className="icon-button" type="button" onClick={toggleLike} disabled={!track} title="Like">
            <Heart size={18} fill={liked || track?.liked ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="player-controls">
          <div className="player-controls__buttons">
            <button
              className={`icon-button ${player.shuffle ? 'is-active' : ''}`}
              type="button"
              onClick={player.toggleShuffle}
              title="Shuffle"
            >
              <Shuffle size={18} />
            </button>
            <button className="icon-button" type="button" onClick={player.previous} disabled={!track} title="Previous">
              <SkipBack size={20} />
            </button>
            <button className="play-button" type="button" onClick={player.playPause} disabled={!track} title={player.isPlaying ? 'Pause' : 'Play'}>
              {player.isPlaying ? <Pause size={22} /> : <Play size={22} />}
            </button>
            <button className="icon-button" type="button" onClick={player.next} disabled={!track} title="Next">
              <SkipForward size={20} />
            </button>
            <button
              className={`icon-button ${player.repeatMode !== 'off' ? 'is-active' : ''}`}
              type="button"
              onClick={player.cycleRepeat}
              title={`Repeat ${player.repeatMode}`}
            >
              {player.repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </button>
          </div>
          <div className="progress-line">
            <span>{formatDuration(player.progress)}</span>
            <input
              aria-label="Seek"
              type="range"
              min="0"
              max={progressMax}
              value={Math.min(player.progress, progressMax)}
              onChange={(event) => player.seek(Number(event.target.value))}
              disabled={!track}
            />
            <span>{formatDuration(progressMax)}</span>
          </div>
          {player.error && <small className="player-error">{player.error}</small>}
        </div>

        <div className="player-tools">
          <Volume2 size={18} />
          <input
            aria-label="Volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={player.volume}
            onChange={(event) => player.setVolume(Number(event.target.value))}
          />
          <button className="icon-button" type="button" onClick={() => setQueueOpen(true)} title="Queue">
            <ListMusic size={19} />
          </button>
        </div>
      </footer>

      {queueOpen && <QueueDrawer onClose={() => setQueueOpen(false)} />}
    </>
  )
}

function QueueDrawer({ onClose }) {
  const player = usePlayer()
  return (
    <aside className="queue-drawer" aria-label="Queue">
      <div className="queue-drawer__header">
        <h2>Queue</h2>
        <div>
          <button className="text-button" type="button" onClick={player.clearQueue}>
            Clear
          </button>
          <button className="icon-button" type="button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="queue-list">
        {player.queue.map((song, index) => (
          <div className={`queue-item ${index === player.currentIndex ? 'is-current' : ''}`} key={`${song.id}-${index}`}>
            <Artwork imageUrl={song.artwork_url} title={song.title} compact />
            <div>
              <strong>{song.title}</strong>
              <span>{song.artist?.name}</span>
            </div>
            <button className="icon-button" type="button" onClick={() => player.moveQueue(index, Math.max(0, index - 1))} title="Move up">
              <ArrowUp size={16} />
            </button>
            <button className="icon-button" type="button" onClick={() => player.moveQueue(index, Math.min(player.queue.length - 1, index + 1))} title="Move down">
              <ArrowDown size={16} />
            </button>
            {index !== player.currentIndex && (
              <button className="icon-button danger" type="button" onClick={() => player.removeFromQueue(index)} title="Remove">
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}

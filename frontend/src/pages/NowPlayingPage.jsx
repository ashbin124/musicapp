import { Heart, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react'
import { useEffect, useState } from 'react'
import Artwork from '../components/Artwork'
import { usePlayer } from '../context/PlayerContext'
import { setLiked as saveLiked } from '../services/localLibrary'
import { formatDuration } from '../utils/format'

export default function NowPlayingPage() {
  const player = usePlayer()
  const track = player.currentTrack
  const [liked, setLiked] = useState(Boolean(track?.liked))
  const duration = Math.max(player.duration || track?.duration_seconds || 0, 1)

  useEffect(() => {
    setLiked(Boolean(track?.liked))
  }, [track?.id, track?.liked])

  async function toggleLike() {
    if (!track) return
    const next = !(liked || track.liked)
    await saveLiked(track.id, next)
    setLiked(next)
  }

  return (
    <div className="now-playing page">
      {track ? (
        <>
          <Artwork imageUrl={track.artwork_url} title={track.title} className="now-playing__art" />
          <div className="now-playing__meta">
            <h1>{track.title}</h1>
            <p>{track.artist?.name} {track.album?.title ? `• ${track.album.title}` : ''}</p>
          </div>
          <div className="now-playing__progress">
            <input type="range" min="0" max={duration} value={Math.min(player.progress, duration)} onChange={(event) => player.seek(Number(event.target.value))} />
            <div><span>{formatDuration(player.progress)}</span><span>{formatDuration(duration)}</span></div>
          </div>
          <div className="now-playing__controls">
            <button className={`icon-button ${player.shuffle ? 'is-active' : ''}`} type="button" onClick={player.toggleShuffle} title="Shuffle"><Shuffle size={22} /></button>
            <button className="icon-button" type="button" onClick={player.previous} title="Previous"><SkipBack size={28} /></button>
            <button className="play-button large" type="button" onClick={player.playPause} title={player.isPlaying ? 'Pause' : 'Play'}>
              {player.isPlaying ? <Pause size={30} /> : <Play size={30} />}
            </button>
            <button className="icon-button" type="button" onClick={player.next} title="Next"><SkipForward size={28} /></button>
            <button className={`icon-button ${player.repeatMode !== 'off' ? 'is-active' : ''}`} type="button" onClick={player.cycleRepeat} title="Repeat">
              {player.repeatMode === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
            </button>
          </div>
          <div className="now-playing__secondary">
            <button className="icon-button" type="button" onClick={toggleLike} title="Like"><Heart size={22} fill={liked || track.liked ? 'currentColor' : 'none'} /></button>
            <button className="icon-button" type="button" title="Queue"><ListMusic size={22} /></button>
          </div>
        </>
      ) : (
        <div className="empty-state"><h1>No song selected</h1></div>
      )}
    </div>
  )
}

import { Music2, Play, Shuffle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SongRow from '../components/SongRow'
import { usePlayer } from '../context/PlayerContext'
import { LIBRARY_CHANGED_EVENT, listSongs } from '../services/localLibrary'
import { shuffleCopy } from '../utils/arrays'

export default function HomePage() {
  const player = usePlayer()
  const [songs, setSongs] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const data = await listSongs()
        if (active) {
          setSongs(data)
          setError('')
        }
      } catch (err) {
        if (active) setError(err.message || 'Could not load home.')
      }
    }
    load()
    window.addEventListener(LIBRARY_CHANGED_EVENT, load)
    return () => {
      active = false
      window.removeEventListener(LIBRARY_CHANGED_EVENT, load)
    }
  }, [])

  if (error) return <div className="page"><p className="form-error">{error}</p></div>
  if (!songs) return <div className="page"><div className="loading-block">Loading</div></div>

  function playAll() {
    if (songs[0]) player.playContext(songs, songs[0].id, { type: 'home', label: 'Music' })
  }

  function shuffleAll() {
    const shuffled = shuffleCopy(songs)
    if (shuffled[0]) player.playContext(shuffled, shuffled[0].id, { type: 'home', label: 'Music' })
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Local library</p>
          <h1>Music</h1>
          <p>{songs.length} song{songs.length === 1 ? '' : 's'} on this device</p>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={playAll} disabled={!songs.length}>
            <Play size={17} /> Play
          </button>
          <button className="text-button" type="button" onClick={shuffleAll} disabled={!songs.length}>
            <Shuffle size={17} /> Shuffle
          </button>
        </div>
      </header>

      {songs.length ? (
        <div className="song-list">
          {songs.map((song, index) => (
            <SongRow
              key={song.id}
              song={song}
              tracks={songs}
              context={{ type: 'home', label: 'Music' }}
              index={index}
              onLikeChange={() => listSongs().then(setSongs)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Music2 size={32} />
          <h2>No music yet</h2>
          <p>Import songs on this device from Add Music.</p>
          <Link className="primary-button" to="/add-music">Add Music</Link>
        </div>
      )}
    </div>
  )
}

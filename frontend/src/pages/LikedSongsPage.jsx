import { Shuffle } from 'lucide-react'
import { useEffect, useState } from 'react'
import SongRow from '../components/SongRow'
import { usePlayer } from '../context/PlayerContext'
import { LIBRARY_CHANGED_EVENT, listLikedSongs } from '../services/localLibrary'
import { shuffleCopy } from '../utils/arrays'

export default function LikedSongsPage() {
  const player = usePlayer()
  const [sort, setSort] = useState('recent')
  const [songs, setSongs] = useState([])
  const [error, setError] = useState('')

  async function load() {
    try {
      setSongs(await listLikedSongs(sort))
      setError('')
    } catch (err) {
      setError(err.message || 'Could not load liked songs.')
    }
  }

  useEffect(() => {
    load()
    function onLibraryChanged() {
      load()
    }
    window.addEventListener(LIBRARY_CHANGED_EVENT, onLibraryChanged)
    return () => window.removeEventListener(LIBRARY_CHANGED_EVENT, onLibraryChanged)
  }, [sort])

  function playShuffle() {
    const shuffled = shuffleCopy(songs)
    if (shuffled[0]) player.playContext(shuffled, shuffled[0].id, { type: 'liked', label: 'Liked Songs' })
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Collection</p>
          <h1>Liked Songs</h1>
        </div>
        <div className="header-actions">
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="recent">Recently liked</option>
            <option value="title">Title A-Z</option>
            <option value="artist">Artist A-Z</option>
          </select>
          <button className="text-button" type="button" onClick={playShuffle}>
            <Shuffle size={16} /> Shuffle
          </button>
        </div>
      </header>
      {error && <p className="form-error">{error}</p>}
      <div className="song-list">
        {songs.map((song, index) => (
          <SongRow
            key={song.id}
            song={song}
            tracks={songs}
            context={{ type: 'liked', label: 'Liked Songs' }}
            index={index}
            onLikeChange={load}
          />
        ))}
      </div>
    </div>
  )
}

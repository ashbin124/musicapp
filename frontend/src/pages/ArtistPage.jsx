import { Shuffle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import SongRow from '../components/SongRow'
import { usePlayer } from '../context/PlayerContext'
import { albumsByArtist, getArtist, songsByArtist } from '../services/localLibrary'
import { shuffleCopy } from '../utils/arrays'

export default function ArtistPage() {
  const { id } = useParams()
  const player = usePlayer()
  const [artist, setArtist] = useState(null)
  const [songs, setSongs] = useState([])
  const [albums, setAlbums] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setError('')
    Promise.all([getArtist(id), songsByArtist(id), albumsByArtist(id)])
      .then(([artistData, songData, albumData]) => {
        setArtist(artistData)
        setSongs(songData)
        setAlbums(albumData)
      })
      .catch((err) => setError(err.message || 'Could not load artist.'))
      .finally(() => setLoading(false))
  }, [id])

  if (error) return <div className="page"><p className="form-error">{error}</p></div>
  if (loading) return <div className="page"><div className="loading-block">Loading</div></div>
  if (!artist) return <div className="page"><div className="empty-state"><h2>Artist not found</h2></div></div>

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Artist</p>
          <h1>{artist.name}</h1>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={() => songs[0] && player.playContext(songs, songs[0].id, { type: 'artist', id, label: artist.name })}>Play All</button>
          <button className="text-button" type="button" onClick={() => {
            const shuffled = shuffleCopy(songs)
            if (shuffled[0]) player.playContext(shuffled, shuffled[0].id, { type: 'artist', id, label: artist.name })
          }}><Shuffle size={16} /> Shuffle</button>
        </div>
      </header>
      <section className="section">
        <h2>Songs</h2>
        <div className="song-list">
          {songs.map((song, index) => <SongRow key={song.id} song={song} tracks={songs} context={{ type: 'artist', id, label: artist.name }} index={index} />)}
        </div>
      </section>
      <section className="section">
        <h2>Albums</h2>
        <div className="entity-grid">
          {albums.map((album) => (
            <Link className="entity-card" to={`/albums/${album.id}`} key={album.id}>
              <strong>{album.title}</strong>
              <span>{album.year || 'Album'}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

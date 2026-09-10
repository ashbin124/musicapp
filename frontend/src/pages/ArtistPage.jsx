import { Shuffle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, getErrorMessage } from '../api/client'
import SongRow from '../components/SongRow'
import { usePlayer } from '../context/PlayerContext'
import { shuffleCopy } from '../utils/apiData'

export default function ArtistPage() {
  const { id } = useParams()
  const player = usePlayer()
  const [artist, setArtist] = useState(null)
  const [songs, setSongs] = useState([])
  const [albums, setAlbums] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.get(`/artists/${id}/`), api.get(`/artists/${id}/songs/`), api.get(`/artists/${id}/albums/`)])
      .then(([artistRes, songRes, albumRes]) => {
        setArtist(artistRes.data)
        setSongs(songRes.data)
        setAlbums(albumRes.data)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load artist.')))
  }, [id])

  if (error) return <div className="page"><p className="form-error">{error}</p></div>
  if (!artist) return <div className="page"><div className="loading-block">Loading</div></div>

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

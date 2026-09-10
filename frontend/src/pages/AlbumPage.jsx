import { Shuffle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, getErrorMessage } from '../api/client'
import Artwork from '../components/Artwork'
import SongRow from '../components/SongRow'
import { usePlayer } from '../context/PlayerContext'
import { formatDuration } from '../utils/format'
import { shuffleCopy } from '../utils/apiData'

export default function AlbumPage() {
  const { id } = useParams()
  const player = usePlayer()
  const [album, setAlbum] = useState(null)
  const [tracks, setTracks] = useState([])
  const [error, setError] = useState('')
  const totalDuration = useMemo(() => tracks.reduce((total, song) => total + (song.duration_seconds || 0), 0), [tracks])

  useEffect(() => {
    Promise.all([api.get(`/albums/${id}/`), api.get(`/albums/${id}/tracks/`)])
      .then(([albumRes, trackRes]) => {
        setAlbum(albumRes.data)
        setTracks(trackRes.data)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load album.')))
  }, [id])

  if (error) return <div className="page"><p className="form-error">{error}</p></div>
  if (!album) return <div className="page"><div className="loading-block">Loading</div></div>

  return (
    <div className="page">
      <header className="album-header">
        <Artwork imageUrl={album.artwork_url} title={album.title} />
        <div>
          <p className="eyebrow">Album</p>
          <h1>{album.title}</h1>
          <p>{album.artist?.name} • {album.year || 'Unknown year'} • {formatDuration(totalDuration)}</p>
          <div className="header-actions">
            <button className="primary-button" type="button" onClick={() => tracks[0] && player.playContext(tracks, tracks[0].id, { type: 'album', id, label: album.title })}>Play All</button>
            <button className="text-button" type="button" onClick={() => {
              const shuffled = shuffleCopy(tracks)
              if (shuffled[0]) player.playContext(shuffled, shuffled[0].id, { type: 'album', id, label: album.title })
            }}><Shuffle size={16} /> Shuffle</button>
          </div>
        </div>
      </header>
      <div className="song-list">
        {tracks.map((song, index) => <SongRow key={song.id} song={song} tracks={tracks} context={{ type: 'album', id, label: album.title }} index={index} />)}
      </div>
    </div>
  )
}

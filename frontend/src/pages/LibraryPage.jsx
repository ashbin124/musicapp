import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { api, getErrorMessage } from '../api/client'
import SongRow from '../components/SongRow'
import { usePlayer } from '../context/PlayerContext'
import { getDownloadedIds } from '../services/offlineAudio'
import { collection } from '../utils/apiData'

export default function LibraryPage() {
  const player = usePlayer()
  const outlet = useOutletContext()
  const [songs, setSongs] = useState([])
  const [artists, setArtists] = useState([])
  const [albums, setAlbums] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [playlistName, setPlaylistName] = useState('')
  const [downloadedIds, setDownloadedIds] = useState(new Set())
  const [error, setError] = useState('')

  async function load() {
    try {
      const [songRes, artistRes, albumRes, playlistRes, ids] = await Promise.all([
        api.get('/songs/'),
        api.get('/artists/'),
        api.get('/albums/'),
        api.get('/playlists/'),
        getDownloadedIds(),
      ])
      setSongs(collection(songRes.data))
      setArtists(collection(artistRes.data))
      setAlbums(collection(albumRes.data))
      setPlaylists(collection(playlistRes.data))
      setDownloadedIds(ids)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load library.'))
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function createPlaylist(event) {
    event.preventDefault()
    if (!playlistName.trim()) return
    await api.post('/playlists/', { name: playlistName.trim() })
    setPlaylistName('')
    outlet?.refreshPlaylists?.()
    load()
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Collection</p>
          <h1>Your Library</h1>
        </div>
        <button className="primary-button" type="button" onClick={() => songs[0] && player.playContext(songs, songs[0].id, { type: 'library', label: 'Library' })}>
          Play All
        </button>
      </header>
      {error && <p className="form-error">{error}</p>}
      <section className="section">
        <div className="section__header"><h2>Playlists</h2></div>
        <form className="inline-form" onSubmit={createPlaylist}>
          <input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="New playlist" />
          <button className="icon-button solid" type="submit" title="Create playlist"><Plus size={18} /></button>
        </form>
        <div className="entity-grid">
          {playlists.map((playlist) => (
            <Link className="entity-card" to={`/playlists/${playlist.id}`} key={playlist.id}>
              <strong>{playlist.name}</strong>
              <span>{playlist.track_count} tracks</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="section__header"><h2>Songs</h2></div>
        <div className="song-list">
          {songs.map((song, index) => (
            <SongRow
              key={song.id}
              song={song}
              tracks={songs}
              context={{ type: 'library', label: 'Library' }}
              index={index}
              downloaded={downloadedIds.has(song.id)}
              onDownloadChange={load}
            />
          ))}
        </div>
      </section>
      <EntitySection title="Artists" items={artists} path="artists" primary="name" secondary={(item) => `${item.song_count || 0} songs`} />
      <EntitySection title="Albums" items={albums} path="albums" primary="title" secondary={(item) => item.artist?.name} />
    </div>
  )
}

function EntitySection({ title, items, path, primary, secondary }) {
  return (
    <section className="section">
      <div className="section__header"><h2>{title}</h2></div>
      <div className="entity-grid">
        {items.map((item) => (
          <Link className="entity-card" to={`/${path}/${item.id}`} key={item.id}>
            <strong>{item[primary]}</strong>
            <span>{secondary(item)}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

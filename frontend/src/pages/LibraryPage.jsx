import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import SongRow from '../components/SongRow'
import { usePlayer } from '../context/PlayerContext'
import {
  createPlaylist as createLocalPlaylist,
  LIBRARY_CHANGED_EVENT,
  listAlbums,
  listArtists,
  listPlaylists,
  listSongs,
} from '../services/localLibrary'

export default function LibraryPage() {
  const player = usePlayer()
  const outlet = useOutletContext()
  const [songs, setSongs] = useState([])
  const [artists, setArtists] = useState([])
  const [albums, setAlbums] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [playlistName, setPlaylistName] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try {
      const [songData, artistData, albumData, playlistData] = await Promise.all([
        listSongs(),
        listArtists(),
        listAlbums(),
        listPlaylists(),
      ])
      setSongs(songData)
      setArtists(artistData)
      setAlbums(albumData)
      setPlaylists(playlistData)
      setError('')
    } catch (err) {
      setError(err.message || 'Could not load library.')
    }
  }

  useEffect(() => {
    load()
    window.addEventListener(LIBRARY_CHANGED_EVENT, load)
    return () => window.removeEventListener(LIBRARY_CHANGED_EVENT, load)
  }, [])

  async function createPlaylist(event) {
    event.preventDefault()
    if (!playlistName.trim()) return
    await createLocalPlaylist(playlistName.trim())
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
              onLikeChange={load}
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

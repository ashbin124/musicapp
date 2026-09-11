import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import SongRow from '../components/SongRow'
import { searchLibrary } from '../services/localLibrary'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ songs: [], artists: [], albums: [], playlists: [] })
  const [error, setError] = useState('')

  useEffect(() => {
    const handle = setTimeout(() => {
      if (!query.trim()) {
        setResults({ songs: [], artists: [], albums: [], playlists: [] })
        setError('')
        return
      }
      searchLibrary(query)
        .then((data) => {
          setResults(data)
          setError('')
        })
        .catch((err) => setError(err.message || 'Search failed.'))
    }, 250)
    return () => clearTimeout(handle)
  }, [query])

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Global search</p>
          <h1>Search</h1>
        </div>
      </header>
      <input
        className="search-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Songs, artists, albums, playlists"
        autoFocus
      />
      {error && <p className="form-error">{error}</p>}
      <section className="section">
        <h2>Songs</h2>
        <div className="song-list">
          {results.songs.map((song, index) => (
            <SongRow key={song.id} song={song} tracks={results.songs} context={{ type: 'search', label: query }} index={index} />
          ))}
        </div>
      </section>
      <GroupedLinks title="Artists" items={results.artists} path="artists" primary="name" secondary={(item) => `${item.song_count || 0} songs`} />
      <GroupedLinks title="Albums" items={results.albums} path="albums" primary="title" secondary={(item) => item.artist?.name} />
      <GroupedLinks title="Playlists" items={results.playlists} path="playlists" primary="name" secondary={(item) => `${item.track_count || 0} tracks`} />
    </div>
  )
}

function GroupedLinks({ title, items, path, primary, secondary }) {
  if (!items.length) return null
  return (
    <section className="section">
      <h2>{title}</h2>
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

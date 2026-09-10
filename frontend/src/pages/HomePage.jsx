import { Play, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getErrorMessage } from '../api/client'
import Section from '../components/Section'
import { usePlayer } from '../context/PlayerContext'
import { formatDuration } from '../utils/format'
import { shuffleCopy } from '../utils/apiData'

export default function HomePage() {
  const player = usePlayer()
  const [home, setHome] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/home/')
      .then((response) => setHome(response.data))
      .catch((err) => setError(getErrorMessage(err, 'Could not load home.')))
  }, [])

  if (error) return <div className="page"><p className="form-error">{error}</p></div>
  if (!home) return <div className="page"><div className="loading-block">Loading</div></div>

  const recentSongs = home.recently_played.map((item) => item.song)
  const likedSongs = home.liked_songs.map((item) => item.song)
  const resume = home.continue_listening

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Personal library</p>
          <h1>Home</h1>
        </div>
      </header>

      {resume?.song && (
        <section className="resume-panel">
          <div>
            <span>Continue Listening</span>
            <h2>{resume.song.title}</h2>
            <p>
              {resume.song.artist?.name} • {formatDuration(resume.position_seconds)}
            </p>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() =>
              player.playContext([resume.song], resume.song.id, {
                type: resume.context_type || 'song',
                id: resume.context_id,
                label: resume.context_label || resume.song.title,
              }, resume.position_seconds)
            }
          >
            <RotateCcw size={18} /> Resume
          </button>
        </section>
      )}

      <Section
        title="Recently Played"
        songs={recentSongs}
        context={{ type: 'recent', label: 'Recently Played' }}
        onPlayAll={() => recentSongs[0] && player.playContext(recentSongs, recentSongs[0].id, { type: 'recent', label: 'Recently Played' })}
      />
      <Section
        title="Liked Songs"
        songs={likedSongs}
        context={{ type: 'liked', label: 'Liked Songs' }}
        onPlayAll={() => likedSongs[0] && player.playContext(likedSongs, likedSongs[0].id, { type: 'liked', label: 'Liked Songs' })}
        onShuffle={() => {
          const shuffled = shuffleCopy(likedSongs)
          if (shuffled[0]) player.playContext(shuffled, shuffled[0].id, { type: 'liked', label: 'Liked Songs' })
        }}
      />
      <section className="section">
        <div className="section__header">
          <h2>Your Playlists</h2>
        </div>
        <div className="entity-grid">
          {home.playlists.map((playlist) => (
            <Link className="entity-card" to={`/playlists/${playlist.id}`} key={playlist.id}>
              <strong>{playlist.name}</strong>
              <span>{playlist.track_count} tracks</span>
            </Link>
          ))}
        </div>
      </section>
      <Section
        title="Recently Added"
        songs={home.recently_added}
        context={{ type: 'recently-added', label: 'Recently Added' }}
        onPlayAll={() => home.recently_added[0] && player.playContext(home.recently_added, home.recently_added[0].id, { type: 'recently-added', label: 'Recently Added' })}
      />
      <Section
        title="Suggestions"
        songs={home.suggestions}
        context={{ type: 'suggestions', label: 'Suggestions' }}
        onPlayAll={() => home.suggestions[0] && player.playContext(home.suggestions, home.suggestions[0].id, { type: 'suggestions', label: 'Suggestions' })}
      />
      {!home.recently_added.length && (
        <div className="empty-state">
          <Play size={32} />
          <h2>No music yet</h2>
        </div>
      )}
    </div>
  )
}

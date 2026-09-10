import { Play, Shuffle } from 'lucide-react'
import SongRow from './SongRow'

export default function Section({ title, songs = [], context, onPlayAll, onShuffle }) {
  if (!songs.length) return null
  return (
    <section className="section">
      <div className="section__header">
        <h2>{title}</h2>
        <div className="section__actions">
          {onPlayAll && (
            <button className="text-button" type="button" onClick={onPlayAll}>
              <Play size={16} /> Play
            </button>
          )}
          {onShuffle && (
            <button className="text-button" type="button" onClick={onShuffle}>
              <Shuffle size={16} /> Shuffle
            </button>
          )}
        </div>
      </div>
      <div className="song-list">
        {songs.map((song, index) => (
          <SongRow
            key={`${title}-${song.id}`}
            song={song}
            tracks={songs}
            context={context || { type: title.toLowerCase(), label: title }}
            index={index}
          />
        ))}
      </div>
    </section>
  )
}

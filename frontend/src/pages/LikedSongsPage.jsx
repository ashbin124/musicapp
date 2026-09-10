import { Download, Shuffle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, getErrorMessage } from '../api/client'
import SongRow from '../components/SongRow'
import { usePlayer } from '../context/PlayerContext'
import { downloadSong, getDownloadedIds } from '../services/offlineAudio'
import { collection, shuffleCopy } from '../utils/apiData'

export default function LikedSongsPage() {
  const player = usePlayer()
  const [sort, setSort] = useState('recent')
  const [songs, setSongs] = useState([])
  const [downloadedIds, setDownloadedIds] = useState(new Set())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const [response, ids] = await Promise.all([
        api.get('/liked-songs/', { params: { sort } }),
        getDownloadedIds(),
      ])
      setSongs(collection(response.data).map((item) => item.song))
      setDownloadedIds(ids)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load liked songs.'))
    }
  }

  useEffect(() => {
    load()
  }, [sort])

  async function downloadAll() {
    setBusy(true)
    setError('')
    try {
      for (const song of songs) await downloadSong(song)
      await load()
    } catch (err) {
      setError(err.message || 'Download failed.')
    } finally {
      setBusy(false)
    }
  }

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
          <button className="primary-button" type="button" onClick={downloadAll} disabled={busy || !songs.length}>
            <Download size={17} /> Download
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
            downloaded={downloadedIds.has(song.id)}
            onDownloadChange={load}
          />
        ))}
      </div>
    </div>
  )
}

import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import SongRow from '../components/SongRow'
import { usePlayer } from '../context/PlayerContext'
import { clearDownloads, listDownloads, storageStats } from '../services/offlineAudio'
import { formatStorage } from '../utils/format'

export default function DownloadsPage() {
  const player = usePlayer()
  const [records, setRecords] = useState([])
  const [stats, setStats] = useState({ count: 0, bytes: 0 })
  const songs = useMemo(() => records.map((record) => record.song), [records])

  async function load() {
    const [downloaded, currentStats] = await Promise.all([listDownloads(), storageStats()])
    setRecords(downloaded)
    setStats(currentStats)
  }

  useEffect(() => {
    load()
  }, [])

  async function clearAll() {
    if (!confirm('Clear all downloaded music?')) return
    await clearDownloads()
    load()
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Device storage</p>
          <h1>Downloads</h1>
          <p>Offline music: {stats.count} songs • {formatStorage(stats.bytes)}</p>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={() => songs[0] && player.playContext(songs, songs[0].id, { type: 'downloads', label: 'Downloads' })}>Play</button>
          <button className="text-button danger-text" type="button" onClick={clearAll} disabled={!records.length}><Trash2 size={16} /> Clear</button>
        </div>
      </header>
      {!records.length && <div className="empty-state"><h2>No downloads</h2></div>}
      <div className="song-list">
        {records.map((record, index) => (
          <SongRow
            key={record.id}
            song={record.song}
            tracks={songs}
            context={{ type: 'downloads', label: 'Downloads' }}
            index={index}
            downloaded
            onDownloadChange={load}
          />
        ))}
      </div>
    </div>
  )
}

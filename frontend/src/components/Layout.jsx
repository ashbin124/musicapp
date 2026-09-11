import {
  Disc3,
  Database,
  Heart,
  Home,
  Library,
  PlusCircle,
  Search,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BRAND_NAME } from '../config'
import {
  LIBRARY_CHANGED_EVENT,
  listPlaylists,
  requestPersistentStorage,
} from '../services/localLibrary'
import PlayerBar from './PlayerBar'

export default function Layout() {
  const [playlists, setPlaylists] = useState([])

  async function refreshPlaylists() {
    setPlaylists(await listPlaylists())
  }

  useEffect(() => {
    requestPersistentStorage()
    refreshPlaylists()
    window.addEventListener(LIBRARY_CHANGED_EVENT, refreshPlaylists)
    return () => window.removeEventListener(LIBRARY_CHANGED_EVENT, refreshPlaylists)
  }, [])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <span className="brand__mark">W</span>
          <span>{BRAND_NAME}</span>
        </NavLink>
        <nav className="sidebar__nav">
          <NavLink to="/"><Home size={19} /> Home</NavLink>
          <NavLink to="/search"><Search size={19} /> Search</NavLink>
          <NavLink to="/library"><Library size={19} /> Library</NavLink>
          <NavLink to="/liked"><Heart size={19} /> Liked Songs</NavLink>
          <NavLink to="/add-music"><PlusCircle size={19} /> Add Music</NavLink>
          <NavLink to="/storage"><Database size={19} /> Storage</NavLink>
        </nav>
        <div className="sidebar__playlists">
          <span>Your Playlists</span>
          {playlists.map((playlist) => (
            <NavLink key={playlist.id} to={`/playlists/${playlist.id}`}>
              <Disc3 size={16} /> {playlist.name}
            </NavLink>
          ))}
        </div>
        <p className="sidebar__note">Local library on this device</p>
      </aside>

      <main className="main-content">
        <Outlet context={{ refreshPlaylists }} />
      </main>

      <nav className="mobile-nav">
        <NavLink to="/"><Home size={21} /><span>Home</span></NavLink>
        <NavLink to="/search"><Search size={21} /><span>Search</span></NavLink>
        <NavLink to="/library"><Library size={21} /><span>Library</span></NavLink>
        <NavLink to="/liked"><Heart size={21} /><span>Liked</span></NavLink>
        <NavLink to="/add-music"><PlusCircle size={21} /><span>Add</span></NavLink>
      </nav>
      <PlayerBar />
    </div>
  )
}

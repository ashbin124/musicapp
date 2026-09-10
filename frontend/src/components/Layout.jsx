import {
  Disc3,
  HardDriveDownload,
  Heart,
  Home,
  Library,
  LogOut,
  Search,
  Shield,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { BRAND_NAME } from '../config'
import { useAuth } from '../context/AuthContext'
import PlayerBar from './PlayerBar'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState([])

  useEffect(() => {
    api.get('/playlists/').then((response) => setPlaylists(response.data.results || response.data))
  }, [])

  function signOut() {
    logout()
    navigate('/login')
  }

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
          <NavLink to="/downloads"><HardDriveDownload size={19} /> Downloads</NavLink>
          {user?.is_staff && <NavLink to="/admin"><Shield size={19} /> Admin</NavLink>}
        </nav>
        <div className="sidebar__playlists">
          <span>Your Playlists</span>
          {playlists.map((playlist) => (
            <NavLink key={playlist.id} to={`/playlists/${playlist.id}`}>
              <Disc3 size={16} /> {playlist.name}
            </NavLink>
          ))}
        </div>
        <button className="text-button sidebar__logout" type="button" onClick={signOut}>
          <LogOut size={16} /> {user?.username}
        </button>
      </aside>

      <main className="main-content">
        <Outlet context={{ refreshPlaylists: () => api.get('/playlists/').then((response) => setPlaylists(response.data.results || response.data)) }} />
      </main>

      <nav className="mobile-nav">
        <NavLink to="/"><Home size={21} /><span>Home</span></NavLink>
        <NavLink to="/search"><Search size={21} /><span>Search</span></NavLink>
        <NavLink to="/library"><Library size={21} /><span>Library</span></NavLink>
        <NavLink to="/liked"><Heart size={21} /><span>Liked</span></NavLink>
      </nav>
      <PlayerBar />
    </div>
  )
}

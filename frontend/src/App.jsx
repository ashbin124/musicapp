import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { RequireAdmin, RequireAuth } from './components/Routes'
import { AuthProvider } from './context/AuthContext'
import { PlayerProvider } from './context/PlayerContext'
import AdminPage from './pages/AdminPage'
import AlbumPage from './pages/AlbumPage'
import ArtistPage from './pages/ArtistPage'
import DownloadsPage from './pages/DownloadsPage'
import HomePage from './pages/HomePage'
import LibraryPage from './pages/LibraryPage'
import LikedSongsPage from './pages/LikedSongsPage'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import NowPlayingPage from './pages/NowPlayingPage'
import PlaylistPage from './pages/PlaylistPage'
import SearchPage from './pages/SearchPage'

export default function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="liked" element={<LikedSongsPage />} />
              <Route path="downloads" element={<DownloadsPage />} />
              <Route path="now-playing" element={<NowPlayingPage />} />
              <Route path="playlists/:id" element={<PlaylistPage />} />
              <Route path="artists/:id" element={<ArtistPage />} />
              <Route path="albums/:id" element={<AlbumPage />} />
              <Route element={<RequireAdmin />}>
                <Route path="admin" element={<AdminPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </PlayerProvider>
    </AuthProvider>
  )
}

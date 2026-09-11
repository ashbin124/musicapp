import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { PlayerProvider } from './context/PlayerContext'
import AddMusicPage from './pages/AddMusicPage'
import AlbumPage from './pages/AlbumPage'
import ArtistPage from './pages/ArtistPage'
import DownloadsPage from './pages/DownloadsPage'
import HomePage from './pages/HomePage'
import LibraryPage from './pages/LibraryPage'
import LikedSongsPage from './pages/LikedSongsPage'
import NowPlayingPage from './pages/NowPlayingPage'
import PlaylistPage from './pages/PlaylistPage'
import SearchPage from './pages/SearchPage'

export default function App() {
  return (
    <PlayerProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="liked" element={<LikedSongsPage />} />
          <Route path="storage" element={<DownloadsPage />} />
          <Route path="add-music" element={<AddMusicPage />} />
          <Route path="downloads" element={<Navigate to="/storage" replace />} />
          <Route path="admin" element={<Navigate to="/add-music" replace />} />
          <Route path="now-playing" element={<NowPlayingPage />} />
          <Route path="playlists/:id" element={<PlaylistPage />} />
          <Route path="artists/:id" element={<ArtistPage />} />
          <Route path="albums/:id" element={<AlbumPage />} />
        </Route>
        <Route path="login" element={<Navigate to="/" replace />} />
        <Route path="register" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PlayerProvider>
  )
}

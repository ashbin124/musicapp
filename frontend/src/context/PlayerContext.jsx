import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import { BRAND_NAME } from '../config'
import {
  addToQueue,
  buildPlaybackState,
  getNextIndex,
  getPreviousIndex,
  moveQueueItem,
  playNextQueue,
  restoreOriginalOrder,
  shuffleUpcoming,
} from '../player/queue'
import {
  LIBRARY_CHANGED_EVENT,
  recordRecentlyPlayed,
  resolveAudioSource,
  savePlaybackState,
} from '../services/localLibrary'

const PlayerContext = createContext(null)

const initialState = {
  currentTrack: null,
  queue: [],
  originalQueue: [],
  currentIndex: 0,
  isPlaying: false,
  progress: 0,
  duration: 0,
  volume: Number(localStorage.getItem('wavebox.volume') || 0.8),
  shuffle: localStorage.getItem('wavebox.shuffle') === 'true',
  repeatMode: localStorage.getItem('wavebox.repeat') || 'off',
  playbackContext: null,
  startPosition: 0,
  error: '',
}

function reducer(state, action) {
  switch (action.type) {
    case 'PLAY_CONTEXT':
      return {
        ...state,
        ...buildPlaybackState(action.payload),
        isPlaying: true,
        error: '',
      }
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.isPlaying, error: '' }
    case 'SET_PROGRESS':
      return { ...state, progress: action.progress, duration: action.duration ?? state.duration }
    case 'SET_DURATION':
      return { ...state, duration: action.duration }
    case 'SET_VOLUME':
      return { ...state, volume: action.volume }
    case 'SET_ERROR':
      return { ...state, error: action.error, isPlaying: false }
    case 'NEXT_INDEX':
      return {
        ...state,
        currentIndex: action.index,
        currentTrack: state.queue[action.index] || null,
        progress: 0,
        startPosition: 0,
        isPlaying: action.index >= 0,
      }
    case 'STOP_AT_END':
      return { ...state, isPlaying: false, progress: 0 }
    case 'PLAY_NEXT':
      return {
        ...state,
        queue: playNextQueue(state.queue, state.currentIndex, action.song),
      }
    case 'ADD_TO_QUEUE':
      return { ...state, queue: addToQueue(state.queue, action.song) }
    case 'REMOVE_FROM_QUEUE': {
      const queue = state.queue.filter((_, index) => index !== action.index)
      const currentIndex =
        action.index < state.currentIndex ? state.currentIndex - 1 : state.currentIndex
      return {
        ...state,
        queue,
        currentIndex,
        currentTrack: queue[currentIndex] || state.currentTrack,
      }
    }
    case 'MOVE_QUEUE': {
      const queue = moveQueueItem(state.queue, action.from, action.to)
      const currentIndex = queue.findIndex((track) => track.id === state.currentTrack?.id)
      return { ...state, queue, currentIndex: Math.max(0, currentIndex) }
    }
    case 'CLEAR_QUEUE':
      return { ...state, queue: state.currentTrack ? [state.currentTrack] : [], currentIndex: 0 }
    case 'REMOVE_TRACK': {
      const queue = state.queue.filter((track) => track.id !== action.songId)
      const currentRemoved = state.currentTrack?.id === action.songId
      const currentIndex = currentRemoved
        ? Math.min(state.currentIndex, Math.max(queue.length - 1, 0))
        : queue.findIndex((track) => track.id === state.currentTrack?.id)
      return {
        ...state,
        queue,
        originalQueue: state.originalQueue.filter((track) => track.id !== action.songId),
        currentIndex: Math.max(0, currentIndex),
        currentTrack: queue[currentIndex] || null,
        isPlaying: currentRemoved ? false : state.isPlaying,
      }
    }
    case 'CLEAR_LIBRARY':
      return {
        ...state,
        currentTrack: null,
        queue: [],
        originalQueue: [],
        currentIndex: 0,
        isPlaying: false,
        progress: 0,
        duration: 0,
        startPosition: 0,
      }
    case 'TOGGLE_SHUFFLE': {
      const shuffle = !state.shuffle
      if (!state.currentTrack) return { ...state, shuffle }
      if (shuffle) {
        const shuffled = shuffleUpcoming(state.queue, state.currentIndex)
        return { ...state, shuffle, ...shuffled }
      }
      return { ...state, shuffle, ...restoreOriginalOrder(state.originalQueue, state.currentTrack) }
    }
    case 'CYCLE_REPEAT': {
      const next = state.repeatMode === 'off' ? 'all' : state.repeatMode === 'all' ? 'one' : 'off'
      return { ...state, repeatMode: next }
    }
    default:
      return state
  }
}

export function PlayerProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const audioRef = useRef(new Audio())
  const stateRef = useRef(state)
  const sourceRef = useRef(null)
  const lastTickRef = useRef(0)

  const clearAudioSource = useCallback(() => {
    if (sourceRef.current?.revoke) URL.revokeObjectURL(sourceRef.current.url)
    sourceRef.current = null
  }, [])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const persistPlaybackState = useCallback(async () => {
    const current = stateRef.current
    if (!current.currentTrack) return
    try {
      await savePlaybackState({
        song_id: current.currentTrack.id,
        position_seconds: Math.floor(audioRef.current.currentTime || current.progress || 0),
        context_type: current.playbackContext?.type || '',
        context_id: current.playbackContext?.id || '',
        context_label: current.playbackContext?.label || '',
      })
    } catch {
      // Playback syncing is best effort and should never interrupt listening.
    }
  }, [])

  const persistRecentlyPlayed = useCallback(async (song, position = 0) => {
    if (!song) return
    try {
      await recordRecentlyPlayed(song.id, position)
    } catch {
      // Recent history is best effort and should never interrupt listening.
    }
  }, [])

  const goNext = useCallback(() => {
    const current = stateRef.current
    const index = getNextIndex(current)
    if (index < 0) {
      dispatch({ type: 'STOP_AT_END' })
      persistPlaybackState()
      return
    }
    dispatch({ type: 'NEXT_INDEX', index })
  }, [persistPlaybackState])

  const goPrevious = useCallback(() => {
    const audio = audioRef.current
    if (audio.currentTime > 3) {
      audio.currentTime = 0
      dispatch({ type: 'SET_PROGRESS', progress: 0 })
      return
    }
    const current = stateRef.current
    const index = getPreviousIndex(current)
    dispatch({ type: 'NEXT_INDEX', index })
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    const onTime = () => {
      const now = Date.now()
      if (now - lastTickRef.current < 700) return
      lastTickRef.current = now
      dispatch({
        type: 'SET_PROGRESS',
        progress: audio.currentTime || 0,
        duration: audio.duration || stateRef.current.currentTrack?.duration_seconds || 0,
      })
    }
    const onLoaded = () => {
      dispatch({
        type: 'SET_DURATION',
        duration: audio.duration || stateRef.current.currentTrack?.duration_seconds || 0,
      })
    }
    const onEnded = () => {
      persistRecentlyPlayed(stateRef.current.currentTrack, audio.duration || 0)
      if (stateRef.current.repeatMode === 'one') {
        audio.currentTime = 0
        dispatch({ type: 'SET_PROGRESS', progress: 0 })
        audio.play()
        return
      }
      goNext()
    }
    const onPause = () => persistPlaybackState()

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('pause', onPause)
    }
  }, [goNext, persistRecentlyPlayed, persistPlaybackState])

  useEffect(() => {
    const audio = audioRef.current
    audio.volume = state.volume
    localStorage.setItem('wavebox.volume', String(state.volume))
  }, [state.volume])

  useEffect(() => {
    localStorage.setItem('wavebox.shuffle', String(state.shuffle))
  }, [state.shuffle])

  useEffect(() => {
    localStorage.setItem('wavebox.repeat', state.repeatMode)
  }, [state.repeatMode])

  useEffect(() => {
    const audio = audioRef.current
    const track = state.currentTrack
    if (!track) return

    let cancelled = false
    async function loadSource() {
      clearAudioSource()
      try {
        const source = await resolveAudioSource(track)
        if (cancelled) {
          if (source.revoke) URL.revokeObjectURL(source.url)
          return
        }
        sourceRef.current = source
        audio.src = source.url
        audio.currentTime = state.startPosition || 0
        dispatch({
          type: 'SET_DURATION',
          duration: track.duration_seconds || audio.duration || 0,
        })
        persistRecentlyPlayed(track, state.startPosition || 0)
        if (state.isPlaying) {
          await audio.play()
        }
      } catch (error) {
        dispatch({ type: 'SET_ERROR', error: error.message || 'Unable to play this song.' })
      }
    }
    loadSource()
    return () => {
      cancelled = true
    }
  }, [clearAudioSource, state.currentTrack?.id])

  useEffect(() => {
    return () => {
      clearAudioSource()
    }
  }, [clearAudioSource])

  useEffect(() => {
    const audio = audioRef.current
    if (!state.currentTrack) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      clearAudioSource()
      return
    }
    if (state.isPlaying) {
      audio.play().catch((error) => {
        dispatch({ type: 'SET_ERROR', error: error.message || 'Playback was blocked.' })
      })
    } else {
      audio.pause()
    }
  }, [clearAudioSource, state.isPlaying, state.currentTrack])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (stateRef.current.isPlaying) persistPlaybackState()
    }, 30000)
    const beforeUnload = () => persistPlaybackState()
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [persistPlaybackState])

  useEffect(() => {
    function onLibraryChanged(event) {
      if (event.detail?.type === 'song-deleted') {
        dispatch({ type: 'REMOVE_TRACK', songId: event.detail.songId })
      }
      if (event.detail?.type === 'library-cleared') {
        dispatch({ type: 'CLEAR_LIBRARY' })
      }
    }
    window.addEventListener(LIBRARY_CHANGED_EVENT, onLibraryChanged)
    return () => window.removeEventListener(LIBRARY_CHANGED_EVENT, onLibraryChanged)
  }, [])

  useEffect(() => {
    if (!('mediaSession' in navigator) || !state.currentTrack) return
    const track = state.currentTrack
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist?.name || 'Unknown Artist',
      album: track.album?.title || BRAND_NAME,
      artwork: track.artwork_url
        ? [{ src: track.artwork_url, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    })
    navigator.mediaSession.setActionHandler('play', () => dispatch({ type: 'SET_PLAYING', isPlaying: true }))
    navigator.mediaSession.setActionHandler('pause', () => dispatch({ type: 'SET_PLAYING', isPlaying: false }))
    navigator.mediaSession.setActionHandler('previoustrack', goPrevious)
    navigator.mediaSession.setActionHandler('nexttrack', goNext)
  }, [goNext, goPrevious, state.currentTrack])

  const controls = useMemo(
    () => ({
      ...state,
      playContext(tracks, startId, context, startPosition = 0) {
        dispatch({
          type: 'PLAY_CONTEXT',
          payload: { tracks, startId, context, startPosition },
        })
      },
      playPause() {
        if (!state.currentTrack) return
        dispatch({ type: 'SET_PLAYING', isPlaying: !state.isPlaying })
      },
      pause() {
        dispatch({ type: 'SET_PLAYING', isPlaying: false })
      },
      next: goNext,
      previous: goPrevious,
      seek(seconds) {
        const audio = audioRef.current
        audio.currentTime = seconds
        dispatch({ type: 'SET_PROGRESS', progress: seconds })
      },
      setVolume(volume) {
        dispatch({ type: 'SET_VOLUME', volume })
      },
      playNext(song) {
        dispatch({ type: 'PLAY_NEXT', song })
      },
      addToQueue(song) {
        dispatch({ type: 'ADD_TO_QUEUE', song })
      },
      removeFromQueue(index) {
        dispatch({ type: 'REMOVE_FROM_QUEUE', index })
      },
      moveQueue(from, to) {
        dispatch({ type: 'MOVE_QUEUE', from, to })
      },
      clearQueue() {
        dispatch({ type: 'CLEAR_QUEUE' })
      },
      toggleShuffle() {
        dispatch({ type: 'TOGGLE_SHUFFLE' })
      },
      cycleRepeat() {
        dispatch({ type: 'CYCLE_REPEAT' })
      },
    }),
    [goNext, goPrevious, state],
  )

  return <PlayerContext.Provider value={controls}>{children}</PlayerContext.Provider>
}

export function usePlayer() {
  const value = useContext(PlayerContext)
  if (!value) throw new Error('usePlayer must be used inside PlayerProvider')
  return value
}

export const REPEAT_MODES = ['off', 'all', 'one']

export function buildPlaybackState({ tracks, startId, context, startPosition = 0 }) {
  const queue = tracks.filter(Boolean)
  const foundIndex = queue.findIndex((track) => track.id === startId)
  const currentIndex = foundIndex >= 0 ? foundIndex : 0
  return {
    currentTrack: queue[currentIndex] || null,
    queue,
    originalQueue: queue,
    currentIndex,
    playbackContext: context || null,
    progress: startPosition,
    startPosition,
  }
}

export function moveQueueItem(queue, fromIndex, toIndex) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= queue.length ||
    toIndex >= queue.length
  ) {
    return queue
  }
  const next = [...queue]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export function playNextQueue(queue, currentIndex, song) {
  const beforeAndCurrent = queue.slice(0, currentIndex + 1)
  const upcoming = queue.slice(currentIndex + 1)
  const duplicateIndex = upcoming.findIndex((track) => track.id === song.id)
  if (duplicateIndex >= 0) upcoming.splice(duplicateIndex, 1)
  return [...beforeAndCurrent, song, ...upcoming]
}

export function addToQueue(queue, song) {
  return [...queue, song]
}

export function shuffleUpcoming(queue, currentIndex) {
  const current = queue[currentIndex]
  if (!current) return { queue, currentIndex }
  const previous = queue.slice(0, currentIndex)
  const upcoming = [...queue.slice(currentIndex + 1)]
  for (let index = upcoming.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[upcoming[index], upcoming[swapIndex]] = [upcoming[swapIndex], upcoming[index]]
  }
  return {
    queue: [...previous, current, ...upcoming],
    currentIndex: previous.length,
  }
}

export function restoreOriginalOrder(originalQueue, currentTrack) {
  const currentIndex = originalQueue.findIndex((track) => track.id === currentTrack?.id)
  return {
    queue: originalQueue,
    currentIndex: currentIndex >= 0 ? currentIndex : 0,
  }
}

export function getNextIndex({ currentIndex, queue, repeatMode }) {
  if (!queue.length) return -1
  if (repeatMode === 'one') return currentIndex
  if (currentIndex < queue.length - 1) return currentIndex + 1
  if (repeatMode === 'all') return 0
  return -1
}

export function getPreviousIndex({ currentIndex, queue, repeatMode }) {
  if (!queue.length) return -1
  if (currentIndex > 0) return currentIndex - 1
  if (repeatMode === 'all') return queue.length - 1
  return currentIndex
}

import { describe, expect, it, vi } from 'vitest'
import {
  getNextIndex,
  moveQueueItem,
  playNextQueue,
  restoreOriginalOrder,
  shuffleUpcoming,
} from './queue'

const songs = [
  { id: 1, title: 'A' },
  { id: 2, title: 'B' },
  { id: 3, title: 'C' },
  { id: 4, title: 'D' },
]

describe('queue logic', () => {
  it('moves an existing upcoming song directly after the current song for play next', () => {
    const queue = playNextQueue(songs, 0, songs[3])
    expect(queue.map((song) => song.title)).toEqual(['A', 'D', 'B', 'C'])
  })

  it('adds a new play-next song after the current song', () => {
    const queue = playNextQueue(songs.slice(0, 3), 1, songs[3])
    expect(queue.map((song) => song.title)).toEqual(['A', 'B', 'D', 'C'])
  })

  it('preserves the current song when shuffling upcoming tracks', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = shuffleUpcoming(songs, 1)
    expect(result.queue[result.currentIndex].title).toBe('B')
    expect(result.queue.slice(0, result.currentIndex).map((song) => song.title)).toEqual(['A'])
    spy.mockRestore()
  })

  it('restores original context ordering around the current song', () => {
    const result = restoreOriginalOrder(songs, songs[2])
    expect(result.queue.map((song) => song.title)).toEqual(['A', 'B', 'C', 'D'])
    expect(result.currentIndex).toBe(2)
  })

  it('handles repeat modes for next index', () => {
    expect(getNextIndex({ queue: songs, currentIndex: 3, repeatMode: 'off' })).toBe(-1)
    expect(getNextIndex({ queue: songs, currentIndex: 3, repeatMode: 'all' })).toBe(0)
    expect(getNextIndex({ queue: songs, currentIndex: 2, repeatMode: 'one' })).toBe(2)
  })

  it('moves queue items by index', () => {
    const queue = moveQueueItem(songs, 3, 1)
    expect(queue.map((song) => song.title)).toEqual(['A', 'D', 'B', 'C'])
  })
})

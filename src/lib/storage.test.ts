import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  forgetPosition,
  fromStart,
  readPosition,
  savePosition,
  setPrefs,
  startsOver,
  toggleMyList,
  useInMyList,
  useMyList,
  usePersistentState,
  useSavedPosition,
  useWatchHistory,
} from './storage'

describe('storage hooks', () => {
  it('tracks one video with useInMyList', () => {
    const a = renderHook(() => useInMyList('a')).result
    const b = renderHook(() => useInMyList('b')).result
    expect(a.current[0]).toBe(false)
    act(() => a.current[1]())
    expect(a.current[0]).toBe(true)
    expect(b.current[0]).toBe(false)
    expect(JSON.parse(localStorage.getItem('upou:my-list')!)).toEqual(['a'])
    act(() => toggleMyList('a'))
    expect(a.current[0]).toBe(false)
  })

  it('returns the fallback for invalid JSON and the parsed value otherwise', () => {
    localStorage.setItem('upou:theme', '{oops')
    localStorage.setItem('upou:howitworks', '"yes"')
    localStorage.setItem('upou:esc-hint', 'null')
    const theme = renderHook(() => usePersistentState<unknown>('upou:theme', 'system')).result
    const how = renderHook(() => usePersistentState<unknown>('upou:howitworks', false)).result
    const hint = renderHook(() => usePersistentState<unknown>('upou:esc-hint', false)).result
    expect(theme.current[0]).toBe('system')
    // Wrong-shaped values come back as stored; each caller validates its own.
    expect(how.current[0]).toBe('yes')
    expect(hint.current[0]).toBe(null)
    act(() => theme.current[1]('dark'))
    expect(theme.current[0]).toBe('dark')
    expect(localStorage.getItem('upou:theme')).toBe('"dark"')
  })

  it('keeps the value in memory when storage writes fail', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    const { result } = renderHook(() => useMyList())
    act(() => result.current.toggle('a'))
    expect(result.current.ids).toEqual(['a'])
    spy.mockRestore()
  })

  it('toggles and persists My List', () => {
    const { result } = renderHook(() => useMyList())
    act(() => result.current.toggle('a'))
    expect(result.current.has('a')).toBe(true)
    expect(JSON.parse(localStorage.getItem('upou:my-list')!)).toEqual(['a'])
    act(() => result.current.toggle('a'))
    expect(result.current.ids).toEqual([])
  })

  it('keeps history unique and newest first', () => {
    const { result } = renderHook(() => useWatchHistory())
    act(() => result.current.record('a'))
    act(() => result.current.record('b'))
    act(() => result.current.record('a'))
    expect(result.current.entries.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('ignores corrupt or malformed stored values', () => {
    localStorage.setItem('upou:my-list', '["a", 3, null]')
    localStorage.setItem('upou:history', '[null, 5, {"id": "b", "at": 1}]')
    const list = renderHook(() => useMyList()).result
    const history = renderHook(() => useWatchHistory()).result
    expect(list.current.ids).toEqual(['a'])
    expect(history.current.entries.map((e) => e.id)).toEqual(['b'])
    act(() => history.current.record('c'))
    expect(history.current.entries.map((e) => e.id)).toEqual(['c', 'b'])
  })

  it('reads stored lists once per id, history capped at 20', () => {
    localStorage.setItem('upou:my-list', '["a", "a", "b"]')
    const old = Array.from({ length: 30 }, (_, i) => ({ id: `v${i % 25}`, at: 100 - i }))
    localStorage.setItem('upou:history', JSON.stringify(old))
    expect(renderHook(() => useMyList()).result.current.ids).toEqual(['a', 'b'])
    const entries = renderHook(() => useWatchHistory()).result.current.entries
    expect(entries.map((e) => e.id)).toEqual(Array.from({ length: 20 }, (_, i) => `v${i}`))
  })

  it('falls back when stored JSON is invalid', () => {
    localStorage.setItem('upou:my-list', '{not json')
    const { result } = renderHook(() => useMyList())
    expect(result.current.ids).toEqual([])
    act(() => result.current.toggle('a'))
    expect(result.current.ids).toEqual(['a'])
  })

  it('follows changes made in another tab', () => {
    const { result } = renderHook(() => useMyList())
    act(() => {
      localStorage.setItem('upou:my-list', '["x"]')
      window.dispatchEvent(new StorageEvent('storage', { key: 'upou:my-list' }))
    })
    expect(result.current.ids).toEqual(['x'])
  })
})

describe('saved places (resume)', () => {
  const stored = () =>
    JSON.parse(localStorage.getItem('upou:positions') ?? '[]') as { id: string }[]
  // Off by default; the viewer turns on "Remember where I stopped".
  beforeEach(() => setPrefs({ resume: true }))

  it('keeps nothing in the first 10 s, then the whole second, newest first and once', () => {
    savePosition('a', 9.9, 600)
    expect(readPosition('a')).toBeUndefined()
    expect(localStorage.getItem('upou:positions')).toBeNull()
    savePosition('a', 75.8, 600)
    savePosition('b', 20, 600)
    savePosition('a', 90, 600)
    expect(readPosition('a')).toBe(90)
    expect(stored().map((e) => e.id)).toEqual(['a', 'b'])
    // Starting over keeps the old place until 10 s have played again.
    savePosition('a', 4, 600)
    expect(readPosition('a')).toBe(90)
  })

  it('forgets a place in the last 5 % or 30 s, whichever is longer, and at the end', () => {
    // 1000 s: the last 50 s.
    savePosition('a', 949, 1000)
    expect(readPosition('a')).toBe(949)
    savePosition('a', 951, 1000)
    expect(readPosition('a')).toBeUndefined()
    // 200 s: the last 30 s.
    savePosition('b', 169, 200)
    expect(readPosition('b')).toBe(169)
    savePosition('b', 171, 200)
    expect(readPosition('b')).toBeUndefined()
    savePosition('c', 100, 600)
    forgetPosition('c')
    expect(readPosition('c')).toBeUndefined()
  })

  it('keeps the last 200, dropping the oldest', () => {
    for (let i = 0; i < 205; i++) savePosition(`v${i}`, 60, 600)
    const ids = stored().map((e) => e.id)
    expect(ids).toHaveLength(200)
    expect(ids[0]).toBe('v204')
    expect(ids).not.toContain('v4')
    expect(readPosition('v5')).toBe(60)
  })

  it('is off until the viewer turns it on, and turning it off deletes the places', () => {
    setPrefs({ resume: false })
    savePosition('a', 60, 600)
    expect(stored()).toEqual([])
    setPrefs({ resume: true })
    savePosition('a', 60, 600)
    expect(readPosition('a')).toBe(60)
    setPrefs({ resume: false })
    expect(readPosition('a')).toBeUndefined()
    expect(stored()).toEqual([])
  })

  it('goes with watch history: off saves and resumes nothing, and clearing deletes it', () => {
    savePosition('a', 60, 600)
    // Suggestions are another matter: the place stays in use.
    setPrefs({ useHistory: false })
    expect(readPosition('a')).toBe(60)
    setPrefs({ useHistory: true })
    setPrefs({ history: false })
    expect(stored()).toEqual([])
    savePosition('a', 60, 600)
    expect(stored()).toEqual([])
    setPrefs({ history: true })
    // Back on, the history does not turn saved places on again by itself.
    savePosition('a', 60, 600)
    expect(stored()).toEqual([])
    setPrefs({ resume: true })
    savePosition('a', 60, 600)
    const { result } = renderHook(() => useWatchHistory())
    act(() => result.current.clear())
    expect(stored()).toEqual([])
  })

  it('drops the place of a video that leaves the watch history', () => {
    const { result } = renderHook(() => useWatchHistory())
    for (let i = 0; i < 21; i++) {
      act(() => result.current.record(`v${i}`))
      savePosition(`v${i}`, 60, 600)
    }
    expect(result.current.entries).toHaveLength(20)
    expect(readPosition('v0')).toBeUndefined()
    expect(readPosition('v1')).toBe(60)
  })

  it('follows saves, clears and malformed values with useSavedPosition', () => {
    localStorage.setItem('upou:positions', '[null, {"id": "a", "t": "60"}, {"id": "b", "t": 0}]')
    const { result } = renderHook(() => useSavedPosition('a'))
    expect(result.current).toBeUndefined()
    act(() => savePosition('a', 61, 600))
    expect(result.current).toBe(61)
    act(() => setPrefs({ history: false }))
    expect(result.current).toBeUndefined()
  })

  it('plays from the start only the video the state names, while its place is unchanged', () => {
    savePosition('a', 60, 600)
    expect(startsOver(fromStart('a', 60), 'a')).toBe(true)
    expect(startsOver({ ...fromStart('a', 60), playlist: {} }, 'b')).toBe(false)
    expect(startsOver(null, 'a')).toBe(false)
    expect(startsOver({ fromStart: true }, 'a')).toBe(false)
    // Watched again past 10 s: Back or a reload to that page resumes the new place.
    savePosition('a', 12, 600)
    expect(startsOver(fromStart('a', 60), 'a')).toBe(false)
  })
})

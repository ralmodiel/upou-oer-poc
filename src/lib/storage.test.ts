import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  toggleMyList,
  useInMyList,
  useMyList,
  usePersistentState,
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

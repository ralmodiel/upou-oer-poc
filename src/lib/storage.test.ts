import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useMyList, useWatchHistory } from './storage'

describe('storage hooks', () => {
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

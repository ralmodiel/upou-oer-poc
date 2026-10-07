import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { addSearch, readProfile, useProfile, useSearchHistory } from './history'
import { toggleMyList, useWatchHistory } from './storage'

const queries = (list: { q: string }[]) => list.map((s) => s.q)

describe('useSearchHistory', () => {
  it('records committed queries newest first, deduped case-insensitively', () => {
    const { result } = renderHook(() => useSearchHistory())
    act(() => result.current.record('Climate'))
    act(() => result.current.record('nursing  care '))
    act(() => result.current.record('climate'))
    expect(queries(result.current.searches)).toEqual(['climate', 'nursing care'])
    expect(queries(JSON.parse(localStorage.getItem('upou:searches')!))).toEqual([
      'climate',
      'nursing care',
    ])
    expect(result.current.searches[0].at).toBeGreaterThan(0)
  })

  it('ignores queries shorter than two characters and keeps the last 20', () => {
    const { result } = renderHook(() => useSearchHistory())
    act(() => result.current.record(' a '))
    expect(result.current.searches).toEqual([])
    act(() => {
      for (let i = 0; i < 25; i++) result.current.record(`query ${i}`)
    })
    expect(result.current.searches).toHaveLength(20)
    expect(result.current.searches[0].q).toBe('query 24')
    expect(result.current.searches[19].q).toBe('query 5')
  })

  it('tolerates malformed stored values and clears', () => {
    localStorage.setItem('upou:searches', '[{"q":"ok","at":1}, 5, {"at":2}]')
    const { result } = renderHook(() => useSearchHistory())
    expect(queries(result.current.searches)).toEqual(['ok'])
    act(() => result.current.clear())
    expect(result.current.searches).toEqual([])
    expect(localStorage.getItem('upou:searches')).toBe('[]')
  })

  it('exposes the pure list update', () => {
    const list = addSearch([{ q: 'old', at: 1 }], 'New', 2)
    expect(list).toEqual([
      { q: 'New', at: 2 },
      { q: 'old', at: 1 },
    ])
    expect(addSearch(list, 'x', 3)).toBe(list)
  })

  it('lets a query typed on after a pause replace the part typed before it', () => {
    let list = addSearch([], 'clim', 1_000)
    list = addSearch(list, 'climate chan', 3_000)
    list = addSearch(list, 'climate change', 5_000)
    expect(list).toEqual([{ q: 'climate change', at: 5_000 }])
    // Much later, a longer query is a search of its own.
    expect(addSearch(list, 'climate change policy', 200_000)).toHaveLength(2)
  })
})

describe('useProfile', () => {
  it('composes history, searches and My List and keeps its identity until they change', () => {
    const { result, rerender } = renderHook(() => ({
      profile: useProfile(),
      history: useWatchHistory(),
      searches: useSearchHistory(),
    }))
    const first = result.current.profile
    expect(first).toEqual({ watched: [], searches: [], saved: [] })
    rerender()
    expect(result.current.profile).toBe(first)

    act(() => result.current.history.record('v1'))
    act(() => result.current.searches.record('gender'))
    act(() => toggleMyList('v2'))
    const profile = result.current.profile
    expect(profile).not.toBe(first)
    expect(profile.watched.map((e) => e.id)).toEqual(['v1'])
    expect(queries(profile.searches)).toEqual(['gender'])
    expect(profile.saved).toEqual(['v2'])
    expect(readProfile()).toEqual(profile)
  })

  it('reads an empty profile outside React, even over corrupt storage', () => {
    expect(readProfile()).toEqual({ watched: [], searches: [], saved: [] })
    localStorage.setItem('upou:history', '{bad')
    localStorage.setItem('upou:my-list', '["a", 1]')
    expect(readProfile()).toEqual({ watched: [], searches: [], saved: ['a'] })
  })
})

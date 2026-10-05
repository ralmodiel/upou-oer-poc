import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { readProfile, useProfile, useSearchHistory } from './history'
import { historyAllowed, readPrefs, resetStorageCache, setPrefs, useWatchHistory } from './storage'

describe('privacy prefs', () => {
  it('defaults to everything on but saved places, and ignores malformed values', () => {
    const { resume, ...rest } = readPrefs()
    expect(resume).toBe(false)
    expect(Object.values(rest).every(Boolean)).toBe(true)
    localStorage.setItem('upou:prefs', '{"history":"no","searches":false,"resume":"yes"}')
    resetStorageCache()
    expect(readPrefs()).toMatchObject({
      history: true,
      searches: false,
      recentlyViewed: true,
      resume: false,
    })
  })

  it('turning watch history off deletes it and stops recording', () => {
    const { result } = renderHook(() => useWatchHistory())
    act(() => result.current.record('a'))
    expect(result.current.entries.map((e) => e.id)).toEqual(['a'])
    act(() => setPrefs({ history: false }))
    expect(result.current.entries).toEqual([])
    act(() => result.current.record('b'))
    expect(result.current.entries).toEqual([])
  })

  it('keeps watch history out of the profile when its use is off', () => {
    const history = renderHook(() => useWatchHistory()).result
    act(() => history.current.record('a'))
    const profile = renderHook(() => useProfile()).result
    expect(profile.current.watched.map((e) => e.id)).toEqual(['a'])
    act(() => setPrefs({ useHistory: false }))
    expect(profile.current.watched).toEqual([])
    expect(readProfile().watched).toEqual([])
    expect(historyAllowed(readPrefs())).toBe(false)
  })

  it('turning searches off deletes them and stops recording', () => {
    const { result } = renderHook(() => useSearchHistory())
    act(() => result.current.record('climate'))
    act(() => setPrefs({ searches: false }))
    expect(result.current.searches).toEqual([])
    act(() => result.current.record('health'))
    expect(result.current.searches).toEqual([])
  })
})

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { bootstrapTheme, THEME_KEY, useTheme } from './theme'

describe('theme', () => {
  it('bootstraps the stored theme onto <html>', () => {
    localStorage.setItem(THEME_KEY, JSON.stringify('dark'))
    bootstrapTheme()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('falls back to the system theme for missing or junk values', () => {
    localStorage.setItem(THEME_KEY, '"purple"')
    bootstrapTheme()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('persists the choice and updates data-theme', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('system')
    expect(result.current.resolved).toBe('light')

    act(() => result.current.setTheme('dark'))
    expect(result.current.theme).toBe('dark')
    expect(result.current.resolved).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('"dark"')

    act(() => result.current.setTheme('system'))
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('cross-fades a switch once, however many callers apply it', async () => {
    let finish = () => {}
    // Like the browser: the update runs a moment later, after the old view is captured.
    const start = vi.fn((update: () => void) => {
      queueMicrotask(update)
      return { finished: new Promise<void>((resolve) => (finish = resolve)) }
    })
    Object.assign(document, { startViewTransition: start })
    try {
      const a = renderHook(() => useTheme())
      renderHook(() => useTheme())
      act(() => a.result.current.setTheme('light'))
      start.mockClear()
      await act(async () => a.result.current.setTheme('dark'))
      expect(start).toHaveBeenCalledTimes(1)
      expect(document.documentElement.dataset.theme).toBe('dark')
      expect(document.documentElement.dataset.themeFade).toBe('dark')
      await act(async () => finish())
      expect(document.documentElement.dataset.themeFade).toBeUndefined()
    } finally {
      Reflect.deleteProperty(document, 'startViewTransition')
    }
  })
})

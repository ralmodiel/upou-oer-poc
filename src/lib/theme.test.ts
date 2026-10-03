import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
})

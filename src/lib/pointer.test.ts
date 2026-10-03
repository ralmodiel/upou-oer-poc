import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FINE_POINTER_QUERY, lastInput, useInputModality, usePointerKind } from './pointer'

const original = window.matchMedia

afterEach(() => {
  window.matchMedia = original
})

describe('usePointerKind', () => {
  it('is coarse unless the device hovers with a fine pointer', () => {
    expect(renderHook(() => usePointerKind()).result.current).toBe('coarse')
    window.matchMedia = vi.fn(
      (query: string) =>
        ({
          matches: query === FINE_POINTER_QUERY,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    )
    expect(renderHook(() => usePointerKind()).result.current).toBe('fine')
  })
})

describe('useInputModality', () => {
  it('follows the input used last: keyboard after a key press, pointer after a pointer press', () => {
    const { result } = renderHook(() => useInputModality())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    })
    expect(result.current).toBe('keyboard')
    expect(lastInput()).toBe('keyboard')
    act(() => {
      window.dispatchEvent(new Event('pointerdown'))
    })
    expect(result.current).toBe('pointer')
    expect(lastInput()).toBe('pointer')
  })
})

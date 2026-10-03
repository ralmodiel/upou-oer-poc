import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FINE_POINTER_QUERY, usePointerKind } from './pointer'

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

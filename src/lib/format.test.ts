import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('format', () => {
  it('shows publish dates in Manila time wherever the viewer is', async () => {
    vi.stubEnv('TZ', 'America/New_York')
    const { formatDate, yearOf } = await import('./format')
    expect(formatDate('2026-01-25T02:15:36+08:00')).toBe('Jan 25, 2026')
    expect(yearOf('2026-01-01T02:00:00+08:00')).toBe(2026)
  })

  it('tolerates invalid dates', async () => {
    const { formatDate, yearOf } = await import('./format')
    expect(formatDate('not a date')).toBe('')
    expect(yearOf('')).toBeNaN()
  })
})

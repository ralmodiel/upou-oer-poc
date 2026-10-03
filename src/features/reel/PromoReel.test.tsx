import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PromoReel, { REEL_MS } from './PromoReel'
import { buildReelPlan, REEL_TITLE_MAX } from './plan'
import { DECODE_CAP_MS } from './preload'
import { testVideo } from './testing'

afterEach(() => {
  vi.useRealTimers()
})

describe('PromoReel', () => {
  it('starts after the decode cap, shows the title and completes once after REEL_MS', async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    render(<PromoReel video={testVideo} onComplete={onComplete} />)

    expect(
      screen.getByRole('group', { name: `Promo reel: ${testVideo.title}` }),
    ).toBeInTheDocument()
    // Controls carry visible labels; nothing grabs focus (the page focuses its stage instead).
    expect(screen.getByRole('button', { name: 'Skip intro' })).not.toHaveFocus()
    expect(document.body).toHaveFocus()

    await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))
    expect(screen.getByText(testVideo.title)).toBeInTheDocument()
    expect(screen.getByText('UPOU Networks')).toBeInTheDocument()
    expect(
      screen.getByText('Learn how raw numbers become insight.', { exact: false }),
    ).toBeInTheDocument()
    expect(screen.getByText('Starting in', { exact: false })).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(REEL_MS - 1))
    expect(onComplete).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('skips immediately and only once', async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    render(<PromoReel video={testVideo} onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: 'Skip intro' }))
    expect(onComplete).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS + REEL_MS))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('toggles sound with a labelled, remembered button', () => {
    render(<PromoReel video={testVideo} onComplete={() => {}} />)
    const sound = screen.getByRole('button', { name: 'Sound on' })
    expect(sound).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(sound)
    expect(screen.getByRole('button', { name: 'Sound off' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(localStorage.getItem('upou:reel-sound')).toBe('false')
  })

  it('derives a deterministic plan that varies between videos', () => {
    expect(buildReelPlan({ ...testVideo })).toEqual(buildReelPlan(testVideo))

    const plans = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((c) =>
      buildReelPlan({ ...testVideo, youtubeId: c.repeat(11) }),
    )
    expect(new Set(plans.map((p) => p.template)).size).toBeGreaterThan(1)
    expect(new Set(plans.map((p) => p.accent)).size).toBeGreaterThan(1)

    const bare = buildReelPlan({ ...testVideo, description: '', tags: [] })
    expect(bare.hook).toMatch(/Technology and Teaching/)
    expect(bare.tags).toEqual([])
    expect(bare.lowRes).toBe(false)
    expect(bare.meta).toEqual(['UP Open University', 'Technology and Teaching · 2025'])
  })

  it('clamps very long titles and frames low-res stills', () => {
    const long = buildReelPlan({ ...testVideo, title: 'Very long title words '.repeat(20) })
    expect(long.title.length).toBeLessThanOrEqual(REEL_TITLE_MAX)
    expect(long.title).toMatch(/^Very long title words .*\S…$/)
    expect(long.lines.flatMap((l) => l.words).length).toBeLessThan(80)

    const mq = buildReelPlan({
      ...testVideo,
      frames: [1, 2, 3].map((n) => `https://i.ytimg.com/vi/abcDEF12345/mq${n}.jpg`),
    })
    expect(mq.lowRes).toBe(true)
  })
})

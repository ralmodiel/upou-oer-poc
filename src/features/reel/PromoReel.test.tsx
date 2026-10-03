import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PromoReel, { REEL_MS } from './PromoReel'
import { buildReelPlan } from './plan'
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
      screen.getByRole('region', { name: `Promo reel: ${testVideo.title}` }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip Intro' })).toHaveFocus()

    await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))
    expect(screen.getByText(testVideo.title)).toBeInTheDocument()
    expect(
      screen.getByText('Learn how raw numbers become insight.', { exact: false }),
    ).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(REEL_MS - 1))
    expect(onComplete).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('skips immediately and only once', async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    render(<PromoReel video={testVideo} onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: 'Skip Intro' }))
    expect(onComplete).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS + REEL_MS))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('derives a deterministic plan that varies between videos', () => {
    expect(buildReelPlan({ ...testVideo })).toEqual(buildReelPlan(testVideo))

    const templates = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(
        (c) => buildReelPlan({ ...testVideo, youtubeId: c.repeat(11) }).template,
      ),
    )
    expect(templates.size).toBeGreaterThan(1)

    const bare = buildReelPlan({ ...testVideo, description: '', tags: [] })
    expect(bare.hook).toMatch(/Technology and Teaching/)
    expect(bare.tags).toEqual([])
  })
})

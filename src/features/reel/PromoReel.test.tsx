import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
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

    expect(screen.getByRole('group', { name: `Preview: ${testVideo.title}` })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading preview')
    // Controls carry visible labels; nothing grabs focus (the page focuses its stage instead).
    expect(screen.getByRole('button', { name: 'Skip preview' })).not.toHaveFocus()
    expect(document.body).toHaveFocus()

    await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))
    expect(screen.getByText(testVideo.title)).toBeInTheDocument()
    expect(screen.getByText('UPOU OER')).toBeInTheDocument()
    expect(
      screen.getByText('Learn how raw numbers become insight.', { exact: false }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Starting in/)
    expect(screen.getByRole('progressbar', { name: 'Preview progress' })).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(REEL_MS - 1))
    expect(onComplete).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('skips immediately and only once', async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    render(<PromoReel video={testVideo} onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: 'Skip preview' }))
    expect(onComplete).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS + REEL_MS))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('starts muted, toggles with a labelled pressed button and remembers the choice', () => {
    render(<PromoReel video={testVideo} onComplete={() => {}} />)
    const sound = screen.getByRole('button', { name: 'Unmute' })
    expect(sound).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(sound)
    expect(screen.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('upou:reel-sound')).toBe('true')
  })

  it('treats anything but a stored true as muted; `muted` drops the sound control', () => {
    localStorage.setItem('upou:reel-sound', '"on"')
    const first = render(<PromoReel video={testVideo} onComplete={() => {}} />)
    expect(screen.getByRole('button', { name: 'Unmute' })).toHaveAttribute('aria-pressed', 'false')
    first.unmount()

    render(<PromoReel video={testVideo} onComplete={() => {}} muted />)
    expect(screen.queryByRole('button', { name: /mute/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip preview' })).toBeInTheDocument()
  })

  it('preview variant: decorative, silent, no chrome, 320px stills, same timeline', async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    const { container } = render(
      <PromoReel video={testVideo} variant="preview" onComplete={onComplete} />,
    )
    const root = container.querySelector('.reel')
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root).toHaveAttribute('data-variant', 'preview')
    expect(root).not.toHaveAttribute('role')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))
    const srcs = [...container.querySelectorAll<HTMLImageElement>('.reel-kb img')].map((i) => i.src)
    expect(srcs).toEqual(testVideo.thumbnails?.slice(1))
    expect(container.querySelector('.reel-grain, .reel-progress, .reel-count')).toBeNull()
    expect(container.querySelector('.reel-end-title')).toHaveTextContent(testVideo.title)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(REEL_MS))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('leaves no timers behind when unmounted early, and completes once under StrictMode', async () => {
    vi.useFakeTimers()
    const early = render(<PromoReel video={testVideo} variant="preview" onComplete={() => {}} />)
    await act(() => vi.advanceTimersByTimeAsync(300))
    early.unmount()
    expect(vi.getTimerCount()).toBe(0)

    const onComplete = vi.fn()
    const strict = render(
      <StrictMode>
        <PromoReel video={testVideo} variant="preview" onComplete={onComplete} />
      </StrictMode>,
    )
    await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))
    await act(() => vi.advanceTimersByTimeAsync(REEL_MS))
    expect(onComplete).toHaveBeenCalledTimes(1)
    strict.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('derives a deterministic plan that varies between videos', () => {
    expect(buildReelPlan({ ...testVideo })).toEqual(buildReelPlan(testVideo))

    const plans = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((c) =>
      buildReelPlan({ ...testVideo, youtubeId: c.repeat(11) }),
    )
    expect(new Set(plans.map((p) => p.template)).size).toBeGreaterThan(1)
    expect(new Set(plans.map((p) => p.accent)).size).toBeGreaterThan(1)
    expect(plans.map((p) => p.accent)).not.toContain('maroon')

    // No description: the topics stand in; no topics either: no hook (no boilerplate line).
    const topical = buildReelPlan({ ...testVideo, description: '' })
    expect(topical.hook).toBe('TechTips · Open Data · Statistics')
    const bare = buildReelPlan({ ...testVideo, description: '', tags: [] })
    expect(bare.hook).toBe('')
    expect(bare.tags).toEqual([])
    expect(bare.lowRes).toBe(false)
    expect(bare.meta).toEqual(['UP Open University', 'Technology and Teaching · 2025'])
    expect(bare.shots.map((s) => s.small)).toEqual(testVideo.thumbnails?.slice(1))
  })

  it('clamps very long titles and frames low-res stills', () => {
    const long = buildReelPlan({ ...testVideo, title: 'Very long title words '.repeat(20) })
    expect(long.title.length).toBeLessThanOrEqual(REEL_TITLE_MAX)
    expect(long.title).toMatch(/^Very long title words .*\S…$/)
    expect(long.lines.flatMap((l) => l.words).length).toBeLessThan(80)

    const sd = buildReelPlan({
      ...testVideo,
      frames: [1, 2, 3].map((n) => `https://i.ytimg.com/vi/abcDEF12345/sd${n}.jpg`),
    })
    expect(sd.lowRes).toBe(true)
  })
})

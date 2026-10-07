import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setFrameCrops, setFrameFlags } from '../../data/frameFlags'
import PromoReel, { REEL_MS } from './PromoReel'
import { buildReelPlan, REEL_TITLE_MAX, TICK_AT } from './plan'
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
    // The countdown is announced once, as it starts; its digits on screen are not read.
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.getByRole('progressbar', { name: 'Preview progress' })).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(TICK_AT[0]))
    expect(screen.getByRole('status')).toHaveTextContent('The video is about to start')

    await act(() => vi.advanceTimersByTimeAsync(REEL_MS - TICK_AT[0] - 1))
    expect(onComplete).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('plays a type-only title card, never an image, for a video with no clean image', async () => {
    vi.useFakeTimers()
    setFrameFlags({ [testVideo.youtubeId]: 0b1111 })
    try {
      expect(buildReelPlan(testVideo).shots).toEqual([])
      const onComplete = vi.fn()
      const { container } = render(<PromoReel video={testVideo} onComplete={onComplete} />)
      const reel = container.querySelector('.reel')!
      expect(reel).toHaveAttribute('data-title-card')
      // While the fonts settle: the card with its type already, never the (flagged) thumbnail
      // and never a plain colour.
      expect(screen.getByRole('status')).toHaveTextContent('Loading preview')
      expect(reel.querySelector('.reel-loading .reel-card-title')).toHaveTextContent(
        testVideo.title,
      )

      await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))
      const card = reel.querySelector('.reel-stage .reel-card')!
      expect(card).toHaveAttribute('data-tone')
      expect(card.querySelector('.reel-card-title')).toHaveTextContent(testVideo.title)
      expect(card.querySelector('.reel-card-kicker')).toHaveTextContent(testVideo.category)
      expect(card.querySelector('.reel-card-meta')).toHaveTextContent(/UP Open University · .*2025/)
      // The end card hands over on the same title card; nothing in the reel is an image.
      expect(reel.querySelector('.reel-end-art .reel-card')).not.toBeNull()
      expect(reel.querySelector('img')).toBeNull()
      expect(screen.getByRole('button', { name: 'Skip preview' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument()

      await act(() => vi.advanceTimersByTimeAsync(REEL_MS - 1))
      expect(onComplete).not.toHaveBeenCalled()
      await act(() => vi.advanceTimersByTimeAsync(1))
      expect(onComplete).toHaveBeenCalledTimes(1)
    } finally {
      setFrameFlags({})
    }
  })

  it('plays on the clean poster alone when every still is flagged', async () => {
    vi.useFakeTimers()
    // Stills 1-3 flagged, the original (candidate 0) clean.
    setFrameFlags({ [testVideo.youtubeId]: 0b1110 })
    try {
      const plan = buildReelPlan(testVideo)
      expect(plan.shots.map((s) => s.src)).toEqual([testVideo.backdrop])
      expect(plan.single).toBe(true)
      const { container } = render(
        <PromoReel video={testVideo} variant="preview" onComplete={() => {}} />,
      )
      await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))
      expect(container.querySelector('[data-title-card]')).toBeNull()
      const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'))
      expect(srcs.length).toBeGreaterThan(0)
      expect(srcs.every((src) => /(maxres|mq)default\.jpg$/.test(src ?? ''))).toBe(true)
    } finally {
      setFrameFlags({})
    }
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

  it('stored sound left suspended by the autoplay policy starts on any key or press', async () => {
    vi.useFakeTimers()
    const resume = vi.fn(() => Promise.resolve())
    const param = { value: 0, setTargetAtTime: () => {} }
    class FakeAudioContext {
      state = 'suspended'
      currentTime = 0
      destination = {}
      resume = resume
      suspend = () => Promise.resolve()
      close = () => Promise.resolve()
      addEventListener() {}
      createGain = () => ({ gain: param, connect: () => {} })
    }
    vi.stubGlobal('AudioContext', FakeAudioContext)
    localStorage.setItem('upou:reel-sound', 'true')
    try {
      const { unmount } = render(<PromoReel video={testVideo} onComplete={() => {}} />)
      await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))
      resume.mockClear()
      // A remote's arrow key, away from the reel's own controls.
      fireEvent.keyDown(document.body, { key: 'ArrowRight' })
      expect(resume).toHaveBeenCalledTimes(1)
      fireEvent.pointerDown(document.body)
      expect(resume).toHaveBeenCalledTimes(2)
      unmount()
      fireEvent.keyDown(document.body, { key: 'ArrowRight' })
      expect(resume).toHaveBeenCalledTimes(2)
    } finally {
      vi.unstubAllGlobals()
    }
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

  it('zooms black bars baked into a still out of every frame it fills', async () => {
    vi.useFakeTimers()
    setFrameCrops({ abcDEF12345: [1.3, 1.25, 1.25, 1.25] })
    const zoomOf = (img: Element | null) =>
      (img as HTMLElement | null)?.style.getPropertyValue('--zoom')
    const { container } = render(
      <PromoReel video={testVideo} variant="preview" onComplete={() => {}} />,
    )
    expect(zoomOf(container.querySelector('.reel-loading img'))).toBe('1.3')
    await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))
    for (const img of container.querySelectorAll('.reel-kb img, .reel-fill-shot img'))
      expect(zoomOf(img)).toBe('1.25')
    expect(zoomOf(container.querySelector('.reel-cover img'))).toBe('1.3')
    expect(zoomOf(container.querySelector('.reel-end-art img'))).toBe('1.3')
    setFrameCrops({})
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

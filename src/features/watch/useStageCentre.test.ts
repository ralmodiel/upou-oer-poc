import { afterEach, describe, expect, it, vi } from 'vitest'
import { centreShift, markWatchSwap } from './useStageCentre'

// A 1366x768 laptop: a 64px header, the stage 464px tall under the 56px Back row.
const laptop = { viewport: 768, top: 64, bottom: 0, stageTop: 121, stageHeight: 464, skip: false }

describe('centreShift', () => {
  it('lowers the stage so its centre sits at the optical centre of the room under the header', () => {
    // 64 + 704 × 0.45 − 232 = 148.8 → 28px down.
    expect(centreShift(laptop)).toBe(28)
    expect(centreShift({ ...laptop, at: 0.5 })).toBe(63)
  })

  it('keeps the stage whole in view, above the tab bar on phones', () => {
    // Three quarters down would push it past the fold: it stops at the bottom edge.
    expect(centreShift({ ...laptop, at: 0.75 })).toBe(768 - 464 - 121)
    const phone = { viewport: 844, top: 56, bottom: 60, stageTop: 112, stageHeight: 219 }
    expect(centreShift({ ...phone, skip: false })).toBe(162)
  })

  it('never moves up, nor for a small move, a page opened scrolled or one with no preview', () => {
    // A phone on its side: the stage barely fits under its Back row.
    expect(centreShift({ ...laptop, viewport: 390, stageHeight: 262 })).toBe(0)
    expect(centreShift({ ...laptop, viewport: 600, stageHeight: 400 })).toBe(0)
    expect(centreShift({ ...laptop, skip: true })).toBe(0)
  })
})

describe('markWatchSwap', () => {
  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(document, 'startViewTransition')
  })

  it('marks a page change made from the page for its view transition, then clears the mark', () => {
    vi.useFakeTimers()
    expect(markWatchSwap()).toBe(false)
    Object.defineProperty(document, 'startViewTransition', { value: vi.fn(), configurable: true })
    expect(markWatchSwap()).toBe(true)
    expect(document.documentElement).toHaveAttribute('data-watch-swap')
    vi.advanceTimersByTime(1500)
    expect(document.documentElement).not.toHaveAttribute('data-watch-swap')
  })

  it('marks it "far" when the stage is scrolled out of sight, so it does not fly in', () => {
    Object.defineProperty(document, 'startViewTransition', { value: vi.fn(), configurable: true })
    const wrap = document.body.appendChild(document.createElement('div'))
    wrap.className = 'watch-stage-wrap'
    const at = (top: number) =>
      vi.spyOn(wrap, 'getBoundingClientRect').mockReturnValue({ top, bottom: top + 219 } as DOMRect)
    at(-900)
    markWatchSwap()
    expect(document.documentElement.dataset.watchSwap).toBe('far')
    at(274)
    markWatchSwap()
    expect(document.documentElement.dataset.watchSwap).toBe('')
    wrap.remove()
  })
})

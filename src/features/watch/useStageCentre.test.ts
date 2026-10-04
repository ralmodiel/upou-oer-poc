import { afterEach, describe, expect, it, vi } from 'vitest'
import { centreShift, swapWatchPage } from './useStageCentre'

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

// A stand-in for document.startViewTransition: runs the update, ends when its end is called.
function fakeTransitions() {
  const ends: (() => void)[] = []
  const updates: Promise<void>[] = []
  const start = vi.fn((update: () => Promise<void>) => {
    let end = () => {}
    const finished = new Promise<void>((resolve) => (end = resolve))
    ends.push(end)
    updates.push(update())
    return { ready: Promise.reject(new DOMException('Skipped', 'AbortError')), finished }
  })
  Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true })
  return { start, ends, updates }
}

describe('swapWatchPage', () => {
  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(document, 'startViewTransition')
    document.body.innerHTML = ''
    delete document.documentElement.dataset.watchSwap
  })

  it('changes the page in one marked view transition, holding until the new page is in', async () => {
    const go = vi.fn()
    expect(swapWatchPage(go)).toBe(false)
    expect(go).not.toHaveBeenCalled()
    vi.useFakeTimers()
    const { start, ends, updates } = fakeTransitions()
    document.body.innerHTML = '<div class="watch-page"></div>'
    let held = true
    expect(swapWatchPage(go)).toBe(true)
    void updates[0].then(() => (held = false))
    expect(start).toHaveBeenCalledOnce()
    expect(go).toHaveBeenCalledOnce()
    expect(document.documentElement).toHaveAttribute('data-watch-swap', '')
    await vi.advanceTimersByTimeAsync(100)
    expect(held).toBe(true)
    document.body.innerHTML = '<div class="watch-page"></div>'
    await vi.advanceTimersByTimeAsync(20)
    expect(held).toBe(false)
    // The mark lasts as long as the transition, however slow, not for a fixed time.
    await vi.advanceTimersByTimeAsync(5000)
    expect(document.documentElement).toHaveAttribute('data-watch-swap')
    ends[0]()
    await vi.advanceTimersByTimeAsync(0)
    expect(document.documentElement).not.toHaveAttribute('data-watch-swap')
  })

  it('keeps the mark of a newer change when an earlier transition ends', async () => {
    const { ends } = fakeTransitions()
    swapWatchPage(() => {})
    swapWatchPage(() => {})
    ends[0]()
    await Promise.resolve()
    await Promise.resolve()
    expect(document.documentElement).toHaveAttribute('data-watch-swap')
    ends[1]()
    await vi.waitFor(() => expect(document.documentElement).not.toHaveAttribute('data-watch-swap'))
  })

  it('marks it "far" when the stage is scrolled out of sight, so it does not fly in', () => {
    fakeTransitions()
    const wrap = document.body.appendChild(document.createElement('div'))
    wrap.className = 'watch-stage-wrap'
    const at = (top: number) =>
      vi.spyOn(wrap, 'getBoundingClientRect').mockReturnValue({ top, bottom: top + 219 } as DOMRect)
    at(-900)
    swapWatchPage(() => {})
    expect(document.documentElement.dataset.watchSwap).toBe('far')
    at(274)
    swapWatchPage(() => {})
    expect(document.documentElement.dataset.watchSwap).toBe('')
  })
})

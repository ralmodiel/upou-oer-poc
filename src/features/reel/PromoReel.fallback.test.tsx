import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PromoReel from './PromoReel'
import { DECODE_CAP_MS, settleImages } from './preload'
import { testVideo } from './testing'

vi.mock('./preload', { spy: true })

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(settleImages).mockReset()
})

// No large still loads (a video with no maxres file): the reel falls back, never a blank stage.
describe('PromoReel when its stills fail', () => {
  it('plays on the card-sized stills when every large one fails', async () => {
    vi.useFakeTimers()
    vi.mocked(settleImages)
      .mockImplementationOnce(async (srcs) => srcs.map(() => false))
      .mockImplementationOnce(async (srcs) => srcs.map(() => true))
    const { container } = render(<PromoReel video={testVideo} onComplete={() => {}} />)
    await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))
    expect(settleImages).toHaveBeenCalledTimes(2)
    const [large] = vi.mocked(settleImages).mock.calls[0]
    const [small] = vi.mocked(settleImages).mock.calls[1]
    expect(small).not.toEqual(large)
    expect(container.querySelector('[data-title-card]')).toBeNull()
    const srcs = [...container.querySelectorAll('.reel-stage img')].map((i) =>
      i.getAttribute('src'),
    )
    expect(srcs.length).toBeGreaterThan(0)
    expect(srcs.every((src) => small.includes(src ?? ''))).toBe(true)
  })

  it('plays the type-only title card when nothing loads at all', async () => {
    vi.useFakeTimers()
    vi.mocked(settleImages).mockImplementation(async (srcs) => srcs.map(() => false))
    const { container } = render(<PromoReel video={testVideo} onComplete={() => {}} />)
    await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))
    const reel = container.querySelector('.reel')!
    expect(reel).toHaveAttribute('data-title-card')
    expect(reel.querySelector('.reel-stage .reel-card-title')).toHaveTextContent(testVideo.title)
    expect(reel.querySelector('.reel-end-art .reel-card')).not.toBeNull()
  })
})

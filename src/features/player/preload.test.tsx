import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readPosition, savePosition, setPrefs } from '../../lib/storage'
import { mayPreload } from '../../lib/youtube'
import { testVideo } from '../reel/testing'
import YouTubePlayer from './YouTubePlayer'

const ORIGIN = 'https://www.youtube-nocookie.com'

function warmPlayer() {
  const player = (warm: boolean) => (
    <MemoryRouter initialEntries={[`/watch/${testVideo.id}`]}>
      <YouTubePlayer video={testVideo} warm={warm} />
    </MemoryRouter>
  )
  const view = render(player(true))
  const frame = screen.getByTitle(/YouTube video\)$/) as HTMLIFrameElement
  fireEvent.load(frame)
  const post = vi.spyOn(frame.contentWindow!, 'postMessage')
  const send = (event: string, info?: unknown) =>
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ORIGIN,
          data: JSON.stringify({ event, info }),
          source: frame.contentWindow,
        }),
      )
    })
  const commands = () =>
    post.mock.calls.map(([m]) => JSON.parse(String(m))).filter((m) => m.event === 'command')
  return { ...view, frame, send, commands, reveal: () => view.rerender(player(false)) }
}

beforeEach(() => setPrefs({ resume: true }))

describe('a player loaded behind the preview', () => {
  afterEach(() => vi.useRealTimers())

  it('loads unseen and inert, muted, held at its start, and saves nothing', () => {
    savePosition(testVideo.id, 75, 600)
    const { container, frame, send, commands } = warmPlayer()
    expect(frame.src).toContain('autoplay=1&rel=0&playsinline=1&mute=1&')
    expect(frame.src).toContain('&start=75')
    expect(frame).toHaveAttribute('inert')
    expect(frame).toHaveAttribute('aria-hidden', 'true')
    expect(frame).toHaveClass('opacity-0')
    send('onReady')
    // Its muted autoplay is paused at once, put back at the start and unmuted.
    send('infoDelivery', { currentTime: 75.03, duration: 600, playerState: 1 })
    expect(commands()).toMatchObject([
      { func: 'pauseVideo' },
      { func: 'seekTo', args: [75, true] },
      { func: 'unMute' },
    ])
    send('infoDelivery', { currentTime: 75, duration: 600, playerState: 2 })
    expect(container.querySelector('button, .animate-spin, .player-resumed')).toBeNull()
    expect(frame).toHaveClass('opacity-0')
    act(() => void window.dispatchEvent(new Event('pagehide')))
    expect(readPosition(testVideo.id)).toBe(75)
  })

  it('plays once revealed and shows only when it plays', () => {
    vi.useFakeTimers()
    const { frame, send, commands, reveal } = warmPlayer()
    send('onReady')
    send('onStateChange', 1)
    send('onStateChange', 2)
    const primed = commands().length
    reveal()
    expect(frame).not.toHaveAttribute('inert')
    const played = () =>
      commands()
        .slice(primed)
        .map((c) => c.func)
    expect(played()).toEqual(['playVideo'])
    // Paused, YouTube draws its own play button: the poster stays until it plays.
    expect(frame).toHaveClass('opacity-0')
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    // Asked again until it plays (a first command can go astray).
    act(() => vi.advanceTimersByTime(500))
    expect(played()).toHaveLength(2)
    send('onStateChange', 1)
    expect(frame).toHaveClass('opacity-100')
    act(() => vi.advanceTimersByTime(5000))
    expect(played()).toHaveLength(2)
    // Paused by the viewer later, it stays in view.
    send('onStateChange', 2)
    expect(frame).toHaveClass('opacity-100')
    expect(frame.src).toContain('mute=1')
  })

  it('waits for the player when revealed before it is ready', () => {
    const { send, commands, reveal } = warmPlayer()
    reveal()
    expect(commands()).toEqual([])
    send('initialDelivery', {})
    expect(commands()).toEqual([])
    send('onReady')
    expect(commands().map((c) => c.func)).toEqual(['unMute', 'playVideo'])
  })

  it('reloads with sound and autoplay when it has not started 1.5 s after the reveal', () => {
    vi.useFakeTimers()
    const { frame, send, reveal } = warmPlayer()
    send('onReady')
    reveal()
    act(() => vi.advanceTimersByTime(1000))
    expect(frame.src).toContain('mute=1')
    act(() => vi.advanceTimersByTime(500))
    expect(frame.src).toContain('autoplay=1')
    expect(frame.src).not.toContain('mute=1')
    expect(frame).toHaveClass('opacity-0')
    fireEvent.load(frame)
    expect(frame).toHaveClass('opacity-100')
  })

  it('keeps waiting while it buffers', () => {
    vi.useFakeTimers()
    const { frame, send, reveal } = warmPlayer()
    send('onReady')
    reveal()
    send('onStateChange', 3)
    act(() => vi.advanceTimersByTime(6000))
    expect(frame.src).toContain('mute=1')
  })

  it('is not loaded early when the viewer saves data', () => {
    expect(mayPreload()).toBe(true)
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true },
      configurable: true,
    })
    expect(mayPreload()).toBe(false)
    Reflect.deleteProperty(navigator, 'connection')
  })
})

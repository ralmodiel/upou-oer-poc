import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fromStart, readPosition, savePosition, setPrefs } from '../../lib/storage'
import { testVideo } from '../reel/testing'
import YouTubePlayer from './YouTubePlayer'

const ORIGIN = 'https://www.youtube-nocookie.com'

function play(state?: unknown) {
  const view = render(
    <MemoryRouter initialEntries={[{ pathname: `/watch/${testVideo.id}`, state }]}>
      <YouTubePlayer video={testVideo} />
    </MemoryRouter>,
  )
  const frame = screen.getByTitle(/YouTube video\)$/) as HTMLIFrameElement
  fireEvent.load(frame)
  const post = vi.spyOn(frame.contentWindow!, 'postMessage')
  const send = (info: unknown, event = 'infoDelivery') =>
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: ORIGIN,
          data: JSON.stringify({ event, info }),
          source: frame.contentWindow,
        }),
      )
    })
  return { ...view, frame, post, send }
}

const note = (container: HTMLElement) => container.querySelector('.player-resumed')

// Saved places are off by default; the viewer turns on "Remember where I stopped".
beforeEach(() => setPrefs({ resume: true }))

describe('resuming where this browser left a video', () => {
  afterEach(() => vi.useRealTimers())

  it('starts at the saved place and says so until 8 s pass', () => {
    vi.useFakeTimers()
    savePosition(testVideo.id, 75, 600)
    const { container, frame, send } = play()
    expect(frame.src).toContain('&start=75')
    // Nothing until the player answers.
    expect(note(container)).toBeNull()
    send({ currentTime: 75, duration: 600, playerState: 1 })
    expect(note(container)).toHaveTextContent('Resumed at 1:15Start over')
    expect(screen.getByRole('status')).toHaveTextContent('Resumed at 1:15')
    expect(screen.getByRole('button', { name: 'Start over' })).toHaveAccessibleDescription(
      'Resumed at 1:15',
    )
    act(() => vi.advanceTimersByTime(7900))
    expect(note(container)).not.toBeNull()
    act(() => vi.advanceTimersByTime(200))
    expect(note(container)).toBeNull()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('stays while it holds focus, and Start over seeks to 0 and hands focus to the key', () => {
    vi.useFakeTimers()
    savePosition(testVideo.id, 75, 600)
    const { container, post, send } = play()
    send({ currentTime: 75, duration: 600 })
    const startOver = screen.getByRole('button', { name: 'Start over' })
    // First in the stage, so ↓ or Enter on the stage reaches it (WatchPage).
    expect(container.querySelector('button')).toBe(startOver)
    act(() => startOver.focus())
    act(() => vi.advanceTimersByTime(20_000))
    expect(note(container)).not.toBeNull()
    fireEvent.click(startOver)
    const seek = JSON.parse(String(post.mock.lastCall?.[0]))
    expect(seek).toMatchObject({ event: 'command', func: 'seekTo', args: [0, true] })
    expect(post.mock.lastCall?.[1]).toBe(ORIGIN)
    expect(note(container)).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Play' }))
  })

  it('plays from the start when the page asks, keeping the place until 10 s have played', () => {
    savePosition(testVideo.id, 75, 600)
    const { container, frame, send, unmount } = play(fromStart(testVideo.id, 75))
    expect(frame.src).not.toContain('start=')
    send({ currentTime: 3, duration: 600, playerState: 1 })
    expect(note(container)).toBeNull()
    unmount()
    expect(readPosition(testVideo.id)).toBe(75)
    // Past 10 s the new place counts; Back (or a reload) to that page then resumes it.
    const again = play(fromStart(testVideo.id, 75))
    again.send({ currentTime: 12, duration: 600, playerState: 1 })
    again.unmount()
    expect(readPosition(testVideo.id)).toBe(12)
    expect(play(fromStart(testVideo.id, 75)).frame.src).toContain('&start=12')
  })

  it('says nothing of a place past the end (YouTube would start at 0)', () => {
    savePosition(testVideo.id, 900, undefined)
    const { container, send } = play()
    send({ currentTime: 0, duration: 600 })
    expect(note(container)).toBeNull()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('a page asking another video to start over still resumes this one', () => {
    savePosition(testVideo.id, 75, 600)
    const { frame } = play(fromStart('some-other-video', 75))
    expect(frame.src).toContain('&start=75')
  })
})

describe('saving where a video stopped', () => {
  it('saves while playing (every 5 s), on pause, when hidden, on leaving, and forgets at the end', () => {
    let now = 10_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const { send, unmount } = play()
    send({ currentTime: 30.4, duration: 600, playerState: 1 })
    expect(readPosition(testVideo.id)).toBe(30)
    now += 1000
    send({ currentTime: 31 })
    expect(readPosition(testVideo.id)).toBe(30)
    now += 4000
    send({ currentTime: 35 })
    expect(readPosition(testVideo.id)).toBe(35)
    now += 500
    send({ currentTime: 36, playerState: 2 })
    expect(readPosition(testVideo.id)).toBe(36)
    send({ currentTime: 40 })
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(readPosition(testVideo.id)).toBe(40)
    Reflect.deleteProperty(document, 'visibilityState')
    send({ currentTime: 41 })
    act(() => void window.dispatchEvent(new Event('pagehide')))
    expect(readPosition(testVideo.id)).toBe(41)
    send({ currentTime: 50 })
    send(0, 'onStateChange')
    expect(readPosition(testVideo.id)).toBeUndefined()
    unmount()
    expect(readPosition(testVideo.id)).toBeUndefined()
    vi.restoreAllMocks()
  })

  it('saves on leaving the page, and nothing while watch history is off', () => {
    const first = play()
    first.send({ currentTime: 120, duration: 600, playerState: 1 })
    first.send({ currentTime: 130 })
    first.unmount()
    expect(readPosition(testVideo.id)).toBe(130)
    setPrefs({ history: false })
    const second = play()
    second.send({ currentTime: 200, duration: 600, playerState: 1 })
    second.unmount()
    setPrefs({ history: true })
    expect(readPosition(testVideo.id)).toBeUndefined()
  })
})

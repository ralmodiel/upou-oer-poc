import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { setFrameCrops } from '../../data/frameFlags'
import { testVideo } from '../reel/testing'
import YouTubePlayer, { PlayerPoster } from './YouTubePlayer'

describe('PlayerPoster', () => {
  afterEach(() => setFrameCrops({}))

  it('zooms black bars baked into the poster out of the stage, like the reel end card', () => {
    setFrameCrops({ abcDEF12345: [1.3] })
    const { container } = render(
      <PlayerPoster video={{ ...testVideo, poster: testVideo.backdrop }} />,
    )
    const img = container.querySelector('img')!
    expect(img).toHaveAttribute('src', testVideo.backdrop)
    expect(img.style.getPropertyValue('--zoom')).toBe('1.3')
  })
})

describe('the player key time pill', () => {
  it("shows the time played and the length from the embed's info deliveries", () => {
    const { container } = render(
      <MemoryRouter>
        <YouTubePlayer video={testVideo} />
      </MemoryRouter>,
    )
    const frame = screen.getByTitle(/YouTube video\)$/) as HTMLIFrameElement
    fireEvent.load(frame)
    const send = (info: unknown, event = 'infoDelivery') =>
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://www.youtube-nocookie.com',
            data: JSON.stringify({ event, info }),
            source: frame.contentWindow,
          }),
        )
      })
    // No length yet: no pill.
    send({ currentTime: 3 })
    expect(container.querySelector('.watch-player-time')).toBeNull()
    // Whole seconds played; the length rounds, as the embed's own clock shows it.
    send({ currentTime: 75.9, duration: 4814.6 })
    const pill = container.querySelector('.watch-player-time')!
    expect(pill).toHaveTextContent('1:15 / 1:20:15')
    expect(pill).toHaveAttribute('aria-hidden', 'true')
    // Anything else leaves it as it is; under an hour there are no hours.
    send(1, 'onStateChange')
    send({ currentTime: '9', duration: 0 })
    expect(pill).toHaveTextContent('1:15 / 1:20:15')
    send({ currentTime: 5, duration: 125 })
    expect(pill).toHaveTextContent('0:05 / 2:05')
  })
})

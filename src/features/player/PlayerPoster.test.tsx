import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { setFrameCrops } from '../../data/frameFlags'
import { testVideo } from '../reel/testing'
import { PlayerPoster } from './YouTubePlayer'

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

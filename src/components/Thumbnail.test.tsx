import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { setFrameCrops } from '../data/frameFlags'
import Thumbnail from './Thumbnail'
import { fixtureVideos } from './test-fixtures'

const yt = (name: string) => `https://i.ytimg.com/vi/abcdefghijk/${name}.jpg`
const video = { ...fixtureVideos[0], thumbnail: yt('mqdefault'), backdrop: yt('maxresdefault') }
const img = (container: HTMLElement) => container.querySelector('img')!

describe('Thumbnail', () => {
  afterEach(() => setFrameCrops({}))

  it('zooms black bars baked into the still out of its box', () => {
    setFrameCrops({ abcdefghijk: [1.364] })
    const { container } = render(<Thumbnail video={video} sizes="320px" />)
    expect(img(container).style.getPropertyValue('--zoom')).toBe('1.364')
  })

  it('leaves other stills as they are', () => {
    const { container } = render(<Thumbnail video={video} sizes="320px" />)
    expect(img(container).getAttribute('style')).toBeNull()
  })
})

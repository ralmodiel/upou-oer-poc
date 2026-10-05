import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  it('loads a card picture once its card is near the viewport, a hero picture at once', () => {
    const watchers: IntersectionObserverCallback[] = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          watchers.push(cb)
        }
        observe() {}
        disconnect() {}
      },
    )
    try {
      const card = render(<Thumbnail video={video} sizes="320px" />).container
      expect(img(card).getAttribute('src')).toBeNull()
      act(() =>
        watchers.forEach((cb) =>
          cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
        ),
      )
      expect(img(card).getAttribute('src')).toContain('mqdefault')
      const hero = render(<Thumbnail video={video} sizes="100vw" loading="eager" />).container
      expect(img(hero).getAttribute('src')).toContain('mqdefault')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

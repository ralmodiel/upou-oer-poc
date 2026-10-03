import { afterEach, describe, expect, it } from 'vitest'
import { setFrameFlags } from '../../data/frameFlags'
import { isSlideFrame, reelImages } from './stills'
import { testVideo } from './testing'

const still = (name: string) => `https://i.ytimg.com/vi/abcDEF12345/${name}.jpg`
const og = 'https://oer.upou.edu.ph/wp-content/uploads/2026/06/abcDEF12345-e1.jpg'

afterEach(() => setFrameFlags({}))

describe('reelImages', () => {
  it('keeps every image of an unflagged video, small stills paired with large ones', () => {
    const images = reelImages({ ...testVideo, poster: still('maxresdefault') })
    expect(images.stills).toEqual([
      { src: still('maxres1'), small: still('mq1') },
      { src: still('maxres2'), small: still('mq2') },
      { src: still('maxres3'), small: still('mq3') },
    ])
    expect(images.poster).toBe(still('maxresdefault'))
    expect(images.thumbnail).toBe(still('mqdefault'))
  })

  it('never returns a flagged candidate, fallbacks and og:image included', () => {
    setFrameFlags({ abcDEF12345: 0b0011 }) // the original and mq1
    const video = {
      ...testVideo,
      // A catalog fallback that still points at a flagged image.
      poster: og,
      backdrop: og,
      thumbnail: still('mq2'),
      thumbnails: [still('mqdefault'), still('mq2'), still('mq3'), still('mq2')],
      frames: [still('sd2'), still('sd3'), still('sd2')],
    }
    const images = reelImages(video)
    expect(images.poster).toBe(still('sd2'))
    expect(images.stills.map((s) => s.src)).toEqual([still('sd2'), still('sd3'), still('sd2')])
    expect(reelImages({ ...video, frames: [still('sd1')] }).stills).toEqual([])
  })

  it('marks slides and keeps the frames in the order given (best first)', () => {
    setFrameFlags({ abcDEF12345: 0b0100 << 9 }) // mq2 is a slide
    const frames = [still('maxres3'), still('maxres2'), still('maxres1')]
    const images = reelImages({ ...testVideo, frames })
    expect(images.stills.map((s) => s.src)).toEqual(frames)
    expect(images.stills.map((s) => !!s.slide)).toEqual([false, true, false])
    expect(isSlideFrame({ ...testVideo, slides: [false, true, false] }, 1)).toBe(true)
    expect(isSlideFrame(testVideo, 1)).toBe(false)
  })

  it('leaves nothing when every candidate is flagged', () => {
    setFrameFlags({ abcDEF12345: 0b1111 | (2 << 4) }) // the least bad (mq2) is flagged too
    const images = reelImages({ ...testVideo, frames: Array(3).fill(still('maxres2')) })
    expect(images).toEqual({ stills: [], poster: null, thumbnail: null })
  })
})

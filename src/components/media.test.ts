import { afterEach, describe, expect, it } from 'vitest'
import { setFrameFlags } from '../data/frameFlags'
import type { Video } from '../types'
import { heroImageOf, imagesOf, largeImageOf } from './media'
import { fixtureVideos } from './test-fixtures'

const yt = (name: string) => `https://i.ytimg.com/vi/abcdefghijk/${name}.jpg`
const OG = 'https://oer.upou.edu.ph/wp-content/uploads/2026/06/still.jpg'

// A video whose page-load pick is the third still frame of its thumbnail set.
const video = (small: string, backdrop: string): Video => ({
  ...fixtureVideos[0],
  thumbnail: yt(small),
  thumbnails: [yt('mqdefault'), yt('mq1'), yt('mq2'), yt('mq3')],
  backdrop,
})

describe('heroImageOf', () => {
  it('replaces a rotating 1280px frame with the original still', () => {
    expect(heroImageOf(video('mq3', yt('maxres3')))).toBe(yt('maxresdefault'))
  })

  it('keeps an og:image or default backdrop as it is', () => {
    expect(heroImageOf(video('mq3', OG))).toBe(OG)
    expect(heroImageOf(video('mq3', yt('maxresdefault')))).toBe(yt('maxresdefault'))
  })

  it('uses the 640px original when only sd stills exist', () => {
    expect(heroImageOf(video('mq2', yt('sd2')))).toBe(yt('sddefault'))
  })

  it('falls back to the original 320px thumbnail when nothing larger exists', () => {
    expect(heroImageOf(video('mq1', yt('mq1')))).toBe(yt('mqdefault'))
  })
})

describe('hero slots and the frame filter', () => {
  afterEach(() => setFrameFlags({}))
  const v = {
    ...video('mq3', yt('maxres3')),
    frames: [yt('maxres1'), yt('maxres2'), yt('maxres3')],
  }
  const flag = (mask: number) => setFrameFlags({ [v.youtubeId]: mask })

  it('prefers the poster, and never shows a flagged image', () => {
    expect(heroImageOf({ ...v, poster: yt('maxres2') })).toBe(yt('maxres2'))
    // The original is flagged: the first clean still instead, with its own 320px version.
    flag(0b0001)
    expect(heroImageOf(v)).toBe(yt('maxres1'))
    expect(imagesOf(v, true)).toMatchObject({ small: yt('mq1'), large: yt('maxres1') })
    flag(0b0011)
    expect(heroImageOf({ ...v, poster: yt('maxresdefault') })).toBe(yt('maxres2'))
  })

  it('leaves the slot without an image when every image is flagged', () => {
    flag(0b1111)
    expect(heroImageOf(v)).toBeNull()
    expect(imagesOf(v, true)).toBeNull()
    // Card thumbnails too: the data's last-resort original is flagged.
    expect(imagesOf(v)).toBeNull()
  })
})

describe('imagesOf', () => {
  const v = video('mq3', yt('maxres3'))

  it('rotates by default and gives a srcSet of all three sizes', () => {
    expect(imagesOf(v)).toEqual({
      small: yt('mq3'),
      large: yt('maxres3'),
      srcSet: `${yt('mq3')} 320w, ${yt('sd3')} 640w, ${yt('maxres3')} 1280w`,
    })
    expect(largeImageOf(v)).toBe(yt('maxres3'))
  })

  it('returns the original pair when canonical', () => {
    expect(imagesOf(v, true)).toEqual({
      small: yt('mqdefault'),
      large: yt('maxresdefault'),
      srcSet: `${yt('mqdefault')} 320w, ${yt('sddefault')} 640w, ${yt('maxresdefault')} 1280w`,
    })
  })

  it('has no srcSet for a 320px-only video', () => {
    const low = video('mq1', yt('mq1'))
    expect(imagesOf(low)?.srcSet).toBeUndefined()
    expect(imagesOf(low, true)).toMatchObject({ small: yt('mqdefault'), large: yt('mqdefault') })
  })
})

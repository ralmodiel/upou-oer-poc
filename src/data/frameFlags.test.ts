import { afterEach, describe, expect, it } from 'vitest'
import { hashString } from '../lib/seed'
import type { CatalogRecord } from '../types'
import { expandRecord, setLoadSeed } from './expand'
import {
  beautifulMaskOf,
  cropZoomOf,
  fallbackIndexOf,
  flaggedMaskOf,
  keepBoxOf,
  nearDuplicatesOf,
  rankOf,
  setFrameCrops,
  setFrameFlags,
  slideMaskOf,
} from './frameFlags'

const rec: CatalogRecord = { id: 'a-b', y: 'abcdefghijk', t: 'T', c: 'C', p: '2026-01-01' }
const name = (url: string) => url.split('/').pop()!
// Seed that shows member `i` of this record's (unfiltered) thumbnail set.
const seedFor = (i: number) => -hashString(rec.id) + i

afterEach(() => {
  setFrameFlags({})
  setFrameCrops({})
})

/** A frame-flags value from its fields (layout in frameFlags.ts). */
const pack = (f: {
  mask?: number
  fallback?: number
  pairs?: number
  slides?: number
  beautiful?: number
  rank?: number[]
}) =>
  (f.mask ?? 0) |
  ((f.fallback ?? 0) << 4) |
  ((f.pairs ?? 0) << 6) |
  ((f.slides ?? 0) << 9) |
  ((f.beautiful ?? 0) << 13) |
  ((f.rank ?? []).reduce((bits, candidate, place) => bits | (candidate << (2 * place)), 0) << 17)
const seen = (pick: (seed: number) => string) =>
  [...new Set([0, 1, 2, 3, 4, 5, 6, 7].map(pick))].sort()

describe('frame flags', () => {
  it('reads masks defensively', () => {
    setFrameFlags({ abcdefghijk: 6, negative: -1, wide: 0b11111, text: 'x' as unknown as number })
    expect(flaggedMaskOf('abcdefghijk')).toBe(6)
    expect(flaggedMaskOf('unknown')).toBe(0)
    expect(flaggedMaskOf('negative')).toBe(0)
    expect(flaggedMaskOf('text')).toBe(0)
    expect(flaggedMaskOf('wide')).toBe(0b1111)
  })

  it('keeps flagged candidates out of the rotation', () => {
    setFrameFlags({ abcdefghijk: 0b0110 }) // mq1 and mq2 flagged
    const seen = new Set<string>()
    for (let seed = 0; seed < 8; seed++) {
      setLoadSeed(seed)
      const v = expandRecord(rec)
      seen.add(name(v.thumbnail))
      expect(name(v.backdrop)).toBe(name(v.thumbnail).replace('mq', 'maxres'))
    }
    expect([...seen].sort()).toEqual(['mq3.jpg', 'mqdefault.jpg'])
  })

  it('drops flagged stills from the reel and repeats the rest to three shots', () => {
    setFrameFlags({ abcdefghijk: 0b0010 })
    setLoadSeed(seedFor(0))
    const one = expandRecord(rec)
    expect(one.frames.map(name)).toEqual(['maxres2.jpg', 'maxres3.jpg', 'maxres2.jpg'])
    // The small set stays index-aligned with the frames for the reel's low-res placeholders.
    expect(one.thumbnails!.map(name)).toEqual(['mqdefault.jpg', 'mq2.jpg', 'mq3.jpg', 'mq2.jpg'])
    setFrameFlags({ abcdefghijk: 0b0110 })
    expect(expandRecord(rec).frames.map(name)).toEqual([
      'maxres3.jpg',
      'maxres3.jpg',
      'maxres3.jpg',
    ])
    setFrameFlags({ abcdefghijk: 0b0001 }) // only the original flagged: the reel is unchanged
    expect(expandRecord(rec).frames.map(name)).toEqual([
      'maxres1.jpg',
      'maxres2.jpg',
      'maxres3.jpg',
    ])
  })

  it('replaces a flagged original in canonical slots, the source image included', () => {
    setFrameFlags({ abcdefghijk: 0b0011 }) // the original and mq1 flagged
    const og = 'https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg'
    for (let seed = 0; seed < 4; seed++) {
      setLoadSeed(seed)
      const v = expandRecord(rec)
      expect(name(v.poster!)).toBe('maxres2.jpg')
      expect(name(v.thumbnails![0])).toBe('mq2.jpg')
      // Low-res: the source image is the flagged original, so the 640px stills stand in.
      const low = expandRecord({ ...rec, m: 0, b: og })
      expect(['sd2.jpg', 'sd3.jpg']).toContain(name(low.backdrop))
      expect(name(low.poster!)).toBe('sd2.jpg')
    }
  })

  it('falls back to the original images when every candidate is flagged', () => {
    setFrameFlags({ abcdefghijk: 0b1111 })
    for (let seed = 0; seed < 4; seed++) {
      setLoadSeed(seed)
      const v = expandRecord(rec)
      expect(name(v.thumbnail)).toBe('mqdefault.jpg')
      expect(name(v.backdrop)).toBe('maxresdefault.jpg')
      expect(v.frames.map(name)).toEqual([
        'maxresdefault.jpg',
        'maxresdefault.jpg',
        'maxresdefault.jpg',
      ])
    }
    const lowRes = expandRecord({ ...rec, m: 0, b: 'https://oer.upou.edu.ph/x.jpg' })
    expect(lowRes.backdrop).toBe('https://oer.upou.edu.ph/x.jpg')
    expect(lowRes.frames.map(name)).toEqual(['x.jpg', 'x.jpg', 'x.jpg'])
  })

  it('decodes every field of a packed value', () => {
    const all = pack({ mask: 15, fallback: 2, pairs: 0b101, slides: 0b0100, rank: [2, 0, 3, 1] })
    setFrameFlags({ abcdefghijk: all, partial: pack({ mask: 0b0111, fallback: 3 }) })
    expect(flaggedMaskOf('abcdefghijk')).toBe(15)
    expect(fallbackIndexOf('abcdefghijk')).toBe(2)
    expect(nearDuplicatesOf('abcdefghijk')).toEqual([
      [1, 2],
      [2, 3],
    ])
    expect(slideMaskOf('abcdefghijk')).toBe(0b0100)
    expect(beautifulMaskOf('abcdefghijk')).toBe(0)
    expect(rankOf('abcdefghijk')).toEqual([2, 0, 3, 1])
    // The fallback means something only when all four are flagged; no ranking reads undefined.
    expect(fallbackIndexOf('partial')).toBe(0)
    expect(rankOf('partial')).toBeUndefined()
    setFrameFlags({ abcdefghijk: pack({ rank: [1, 1, 2, 3] }) })
    expect(rankOf('abcdefghijk')).toBeUndefined()
  })

  it('shows the least bad candidate on cards when every candidate is flagged', () => {
    setFrameFlags({ abcdefghijk: pack({ mask: 15, fallback: 2 }) })
    expect(seen((seed) => (setLoadSeed(seed), name(expandRecord(rec).thumbnail)))).toEqual([
      'mq2.jpg',
    ])
    const v = expandRecord(rec)
    expect(name(v.poster!)).toBe('maxres2.jpg')
  })

  it('counts near-duplicate stills once', () => {
    setFrameFlags({ abcdefghijk: pack({ pairs: 0b001 }) }) // stills 1 and 2: the same shot
    expect(expandRecord(rec).frames.map(name)).toEqual([
      'maxres1.jpg',
      'maxres3.jpg',
      'maxres1.jpg',
    ])
    expect(seen((seed) => (setLoadSeed(seed), name(expandRecord(rec).thumbnail)))).toEqual([
      'mq1.jpg',
      'mq3.jpg',
      'mqdefault.jpg',
    ])
    setFrameFlags({ abcdefghijk: pack({ pairs: 0b111 }) }) // one shot three times: one still
    expect(new Set(expandRecord(rec).frames).size).toBe(1)
  })

  it('leads with the best candidate and rotates the beautiful ones', () => {
    setFrameFlags({ abcdefghijk: pack({ rank: [2, 0, 3, 1], beautiful: 0b0101 }) })
    const v = expandRecord(rec)
    expect(name(v.poster!)).toBe('maxres2.jpg')
    expect(name(v.thumbnails![0])).toBe('mq2.jpg')
    // Only beautiful stills reach the reel, best first.
    expect(v.frames.map(name)).toEqual(['maxres2.jpg', 'maxres2.jpg', 'maxres2.jpg'])
    expect(seen((seed) => (setLoadSeed(seed), name(expandRecord(rec).thumbnail)))).toEqual([
      'mq2.jpg',
      'mqdefault.jpg',
    ])
  })

  it('shows the best clean candidate when none is beautiful, reel best first', () => {
    setFrameFlags({ abcdefghijk: pack({ mask: 0b0100, rank: [3, 1, 0, 2] }) })
    expect(seen((seed) => (setLoadSeed(seed), name(expandRecord(rec).thumbnail)))).toEqual([
      'mq3.jpg',
    ])
    expect(expandRecord(rec).frames.map(name)).toEqual([
      'maxres3.jpg',
      'maxres1.jpg',
      'maxres3.jpg',
    ])
  })

  it('marks the reel frames that are slides', () => {
    setFrameFlags({ abcdefghijk: pack({ slides: 0b0010 }) })
    expect(expandRecord(rec).slides).toEqual([true, false, false])
    setFrameFlags({ abcdefghijk: pack({ slides: 0b0001 }) }) // only the thumbnail: no reel frame
    expect(expandRecord(rec).slides).toBeUndefined()
  })

  it('reads the keep box of a one-still reel past bit 31, leaving the other fields intact', () => {
    // x0 3, y0 2, x1 - 1 = 12, y1 - 1 = 9 (16ths), with the presence bit.
    const box = 1 + 2 * (3 | (2 << 4) | (12 << 8) | (9 << 12))
    const low = pack({ mask: 0b0010, slides: 0b0100, rank: [2, 3, 0, 1] })
    setFrameFlags({ abcdefghijk: low + box * 2 ** 25, plain: low })
    expect(keepBoxOf('abcdefghijk')).toEqual([3 / 16, 2 / 16, 13 / 16, 10 / 16])
    expect(flaggedMaskOf('abcdefghijk')).toBe(0b0010)
    expect(slideMaskOf('abcdefghijk')).toBe(0b0100)
    expect(rankOf('abcdefghijk')).toEqual([2, 3, 0, 1])
    expect(keepBoxOf('plain')).toBeUndefined()
    expect(keepBoxOf('unknown')).toBeUndefined()
  })

  it('zooms baked-in bars out by candidate and by the shape of the size shown', () => {
    const yt = (name: string) => `https://i.ytimg.com/vi/abcdefghijk/${name}.jpg`
    setFrameCrops({ abcdefghijk: [1.364, 1, [1.334, 1], 3], texttexttex: 'x' })
    expect(cropZoomOf(yt('mqdefault'))).toBe(1.364)
    expect(cropZoomOf(yt('maxresdefault'))).toBe(1.364)
    expect(cropZoomOf(yt('sddefault'))).toBe(1.364)
    expect(cropZoomOf(yt('mq1'))).toBe(1)
    // A 4:3 video: its 16:9 stills carry a pillarbox, its 640px ones show the picture whole.
    expect(cropZoomOf(yt('mq2'))).toBe(1.334)
    expect(cropZoomOf(yt('maxres2'))).toBe(1.334)
    expect(cropZoomOf(yt('sd2'))).toBe(1)
    // Malformed values, unknown videos and source-site images get no zoom.
    expect(cropZoomOf(yt('mq3'))).toBe(1)
    expect(cropZoomOf('https://i.ytimg.com/vi/zzzzzzzzzzz/mqdefault.jpg')).toBe(1)
    expect(cropZoomOf('https://i.ytimg.com/vi/texttexttex/mqdefault.jpg')).toBe(1)
    expect(cropZoomOf('https://oer.upou.edu.ph/wp-content/uploads/still.jpg')).toBe(1)
  })
})

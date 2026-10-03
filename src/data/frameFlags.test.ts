import { afterEach, describe, expect, it } from 'vitest'
import { hashString } from '../lib/seed'
import type { CatalogRecord } from '../types'
import { expandRecord, setLoadSeed } from './expand'
import { flaggedMaskOf, setFrameFlags } from './frameFlags'

const rec: CatalogRecord = { id: 'a-b', y: 'abcdefghijk', t: 'T', c: 'C', p: '2026-01-01' }
const name = (url: string) => url.split('/').pop()!
// Seed that shows member `i` of this record's (unfiltered) thumbnail set.
const seedFor = (i: number) => -hashString(rec.id) + i

afterEach(() => setFrameFlags({}))

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
})

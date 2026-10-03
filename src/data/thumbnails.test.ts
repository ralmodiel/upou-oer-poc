import { describe, expect, it } from 'vitest'
import { hashString } from '../lib/seed'
import type { CatalogRecord } from '../types'
import { expandRecord, setLoadSeed, thumbnailSetOf } from './expand'

const rec: CatalogRecord = { id: 'a-b', y: 'abcdefghijk', t: 'T', c: 'C', p: '2026-01-01' }
const name = (url: string) => url.split('/').pop()

describe('thumbnail set', () => {
  it('rotates thumbnail and backdrop together across page loads', () => {
    const seen = new Set<number>()
    for (let seed = 0; seed < 4; seed++) {
      setLoadSeed(seed)
      const v = expandRecord(rec)
      const i = v.thumbnails!.indexOf(v.thumbnail)
      seen.add(i)
      expect(name(v.backdrop)).toBe(['maxresdefault', 'maxres1', 'maxres2', 'maxres3'][i] + '.jpg')
    }
    expect(seen.size).toBe(4)
  })

  it('keeps the original thumbnail first and the reel frames unchanged', () => {
    setLoadSeed(-hashString(rec.id))
    const v = expandRecord(rec)
    expect(name(v.thumbnail)).toBe('mqdefault.jpg')
    expect(v.thumbnails!.map(name)).toEqual(['mqdefault.jpg', 'mq1.jpg', 'mq2.jpg', 'mq3.jpg'])
    expect(v.frames.map(name)).toEqual(['maxres1.jpg', 'maxres2.jpg', 'maxres3.jpg'])
    expect(thumbnailSetOf({ ...v, thumbnails: undefined })).toEqual([v.thumbnail])
  })

  it('does not rotate the backdrop of videos without hi-res frames', () => {
    setLoadSeed(-hashString(rec.id) + 2)
    const v = expandRecord({ ...rec, m: 0, b: 'https://oer.upou.edu.ph/x.jpg' })
    expect(v.backdrop).toBe('https://oer.upou.edu.ph/x.jpg')
    expect(name(v.thumbnail)).toBe('mq2.jpg')
    expect(v.frames.map(name)).toEqual(['mq1.jpg', 'mq2.jpg', 'mq3.jpg'])
  })
})

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { hashString } from '../lib/seed'
import { expandCatalog, expandRecord, isValidRecord, setLoadSeed } from './expand'

const base = {
  id: 'open-data-101',
  y: 'abcDEF12345',
  t: 'Open Data 101',
  c: 'Research',
  p: '2026-01-25T02:15:36+08:00',
}
const image = (name: string) => `https://i.ytimg.com/vi/abcDEF12345/${name}.jpg`

// Show the first member of each thumbnail set (the original thumbnail).
beforeAll(() => setLoadSeed(-hashString(base.id)))

describe('expandRecord', () => {
  it('derives URLs and defaults for a record with maxres images', () => {
    expect(expandRecord(base)).toEqual({
      id: 'open-data-101',
      youtubeId: 'abcDEF12345',
      title: 'Open Data 101',
      description: '',
      category: 'Research',
      tags: [],
      channel: 'UP Open University',
      publishedAt: '2026-01-25T02:15:36+08:00',
      sourceUrl: 'https://oer.upou.edu.ph/open-data-101/',
      thumbnail: image('mqdefault'),
      thumbnails: [image('mqdefault'), image('mq1'), image('mq2'), image('mq3')],
      backdrop: image('maxresdefault'),
      frames: [image('maxres1'), image('maxres2'), image('maxres3')],
    })
  })

  it('falls back to mq images, with an optional backdrop override', () => {
    const mq = expandRecord({ ...base, m: 0 })
    expect(mq.backdrop).toBe(image('mqdefault'))
    expect(mq.frames).toEqual([image('mq1'), image('mq2'), image('mq3')])
    const og = 'https://oer.upou.edu.ph/wp-content/uploads/still.jpg'
    expect(expandRecord({ ...base, m: 0, b: og }).backdrop).toBe(og)
    // the backdrop override is independent of the frame quality
    const mixed = expandRecord({ ...base, b: og })
    expect(mixed.backdrop).toBe(og)
    expect(mixed.frames[0]).toBe(image('maxres1'))
  })

  it('copies the optional fields', () => {
    expect(
      expandRecord({ ...base, d: 'About.', g: ['Data'], f: 1, ch: 'UPOU FMDS' }),
    ).toMatchObject({ description: 'About.', tags: ['Data'], featured: true, channel: 'UPOU FMDS' })
  })
})

describe('expandCatalog', () => {
  it('skips malformed records with a warning and passes expanded videos through', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const video = { ...expandRecord(base), id: 'already-expanded' }
    const bad = [{ ...base, id: 'Bad Slug' }, { ...base, y: 'short' }, { ...base, t: ' ' }, null]
    expect(bad.some(isValidRecord)).toBe(false)
    expect(expandCatalog([base, ...bad, video]).map((v) => v.id)).toEqual([
      'open-data-101',
      'already-expanded',
    ])
    expect(warn).toHaveBeenCalledTimes(bad.length)
    warn.mockRestore()
  })
})

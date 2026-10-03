import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { videos } from '../data/catalog'
import { setNeighbors } from '../data/recs'
import { setCatalog } from '../data/testing'
import type { Video } from '../types'
import type { Profile } from './history'
import { explain, recommendFor, recommendForProfile, seriesKeyOf } from './recommend'

const make = (id: string, over: Partial<Video> = {}): Video => ({
  id,
  youtubeId: `${id}00000000000`.slice(0, 11),
  title: id,
  description: '',
  category: 'Misc',
  tags: [],
  channel: 'UP Open University',
  publishedAt: '2026-01-01T00:00:00+08:00',
  sourceUrl: `https://oer.upou.edu.ph/${id}/`,
  thumbnail: '',
  backdrop: '',
  frames: [],
  ...over,
})

const science = (id: string, title: string, over: Partial<Video> = {}) =>
  make(id, { title, category: 'Science', ...over })

const list = [
  science('a', 'Intro to Climate Science: Part 1', { tags: ['Climate', 'Weather'] }),
  science('b', 'Intro to Climate Science: Part 2', {
    tags: ['Climate'],
    publishedAt: '2026-01-02T00:00:00+08:00',
  }),
  make('c', {
    title: 'Climate Change and Farming',
    category: 'Agriculture',
    tags: ['Climate', 'Farming'],
    publishedAt: '2026-02-01T00:00:00+08:00',
  }),
  science('d', 'Ocean Weather Patterns', {
    tags: ['Weather'],
    publishedAt: '2026-03-01T00:00:00+08:00',
  }),
  make('e', { title: 'Baking Bread at Home', category: 'Cooking', tags: ['Bread'] }),
  make('f', { title: 'Sourdough Bread Basics', category: 'Cooking', tags: ['Bread', 'Baking'] }),
  make('g', { title: 'Nursing Care Plans', category: 'Health', tags: ['Nursing'] }),
  make('h', { title: 'Quantum Computing Primer', category: 'General' }),
  make('i', { title: 'General Assembly Highlights', category: 'General' }),
]

const ids = (vs: Video[]) => vs.map((v) => v.id)
const profile = (over: Partial<Profile>): Profile => ({
  watched: [],
  searches: [],
  saved: [],
  ...over,
})
const NOW = 1_800_000_000_000

const shipped = videos
beforeEach(() => setCatalog(list))
afterEach(() => {
  setNeighbors({})
  setCatalog(shipped)
})

describe('recommendFor', () => {
  it('ranks the same series first and leaves out videos that share nothing', () => {
    const recs = ids(recommendFor(list[0]))
    expect(recs[0]).toBe('b')
    expect(recs.slice(1).sort()).toEqual(['c', 'd'])
  })

  // Filler keeps the shared terms below the corpus-wide cutoff (idf 0) in tiny fixtures.
  const filler = [
    make('u1', { title: 'Knitting Patterns', category: 'Crafts' }),
    make('u2', { title: 'Jazz History', category: 'Music' }),
  ]

  it('prefers the same category among equal text matches', () => {
    setCatalog([
      make('x', { title: 'Soil Health Basics', category: 'Agriculture' }),
      make('y', { title: 'Soil Health Advanced', category: 'Agriculture' }),
      make('z', {
        title: 'Soil Health Advanced',
        category: 'Science',
        publishedAt: '2026-06-01T00:00:00+08:00',
      }),
      ...filler,
    ])
    const [x] = videos
    expect(ids(recommendFor(x))).toEqual(['y', 'z'])
  })

  it('lets the profile reorder near-ties', () => {
    setCatalog([
      make('x', { title: 'Soil Health Basics', category: 'Agriculture' }),
      make('y', {
        title: 'Soil Health Advanced',
        category: 'Agriculture',
        tags: ['Soil'],
        publishedAt: '2026-06-01T00:00:00+08:00',
      }),
      make('w', { title: 'Soil Health Advanced', category: 'Agriculture', tags: ['Soil', 'Rain'] }),
      make('r', { title: 'Rain Patterns', category: 'Science', tags: ['Rain'] }),
    ])
    const [x] = videos
    expect(ids(recommendFor(x))).toEqual(['y', 'w'])
    const taste = profile({ watched: [{ id: 'r', at: NOW }] })
    expect(ids(recommendFor(x, { profile: taste }))).toEqual(['w', 'y'])
  })

  it('never returns the video itself or excluded ids, and honours the limit', () => {
    expect(ids(recommendFor(list[0], { exclude: ['b'] }))).not.toContain('b')
    expect(ids(recommendFor(list[0], { exclude: new Set(['b', 'c']) }))).toEqual(['d'])
    expect(recommendFor(list[0], { limit: 1 })).toHaveLength(1)
    expect(ids(recommendFor(list[7]))).toEqual([])
  })

  it('caps another category at four in the first eight', () => {
    const others = Array.from({ length: 6 }, (_, i) =>
      make(`s${i}`, {
        title: `Research Methods ${i + 1}`,
        category: 'Science',
        tags: ['Research'],
        publishedAt: `2026-0${i + 1}-01T00:00:00+08:00`,
      }),
    )
    const law = ['o1', 'o2'].map((id) =>
      make(id, { title: `Ethics ${id}`, category: 'Law', tags: ['Research'] }),
    )
    const query = make('q', {
      title: 'Statistics for Research',
      category: 'Math',
      tags: ['Research'],
    })
    setCatalog([query, ...others, ...law])
    expect(ids(recommendFor(query, { limit: 8 }))).toEqual([
      's5',
      's4',
      's3',
      's2',
      'o1',
      'o2',
      's1',
      's0',
    ])
    expect(ids(recommendFor(query, { limit: 3 }))).toEqual(['s5', 's4', 's3'])
  })

  it('merges precomputed neighbors into the score', () => {
    const a = list[0]
    expect(ids(recommendFor(a))).not.toContain('g')
    setNeighbors({
      [a.youtubeId]: [
        [6, 1],
        [0, 1],
        [999, 1],
      ],
    })
    const recs = ids(recommendFor(a))
    expect(recs).toContain('g')
    expect(recs.indexOf('g')).toBeLessThan(recs.indexOf('d'))
    expect(recs).not.toContain('a')
  })

  it('demotes videos the user already watched', () => {
    setCatalog([
      make('x', { title: 'Soil Health Basics', category: 'Agriculture' }),
      make('y', {
        title: 'Soil Health Advanced',
        category: 'Agriculture',
        publishedAt: '2026-06-01T00:00:00+08:00',
      }),
      make('z', { title: 'Soil Health Advanced', category: 'Agriculture' }),
      ...filler,
    ])
    const [x] = videos
    expect(ids(recommendFor(x))).toEqual(['y', 'z'])
    const taste = profile({ watched: [{ id: 'y', at: NOW }] })
    expect(ids(recommendFor(x, { profile: taste }))).toEqual(['z', 'y'])
  })
})

describe('recommendForProfile', () => {
  it('returns nothing for an empty or unknown profile', () => {
    expect(recommendForProfile(profile({}))).toEqual([])
    expect(recommendForProfile(profile({ watched: [{ id: 'nope', at: NOW }] }))).toEqual([])
  })

  it('follows the watch history and skips what was watched or excluded', () => {
    const taste = profile({ watched: [{ id: 'e', at: NOW }] })
    expect(ids(recommendForProfile(taste))).toEqual(['f'])
    expect(recommendForProfile(taste, { exclude: ['f'] })).toEqual([])
  })

  it('mixes in recent searches and saved videos', () => {
    const taste = profile({
      watched: [{ id: 'e', at: NOW }],
      searches: [{ q: 'nursing', at: NOW }],
      saved: ['c'],
    })
    const recs = ids(recommendForProfile(taste))
    expect(recs[0]).toBe('f')
    expect(recs).toContain('g')
    expect(recs).toContain('a')
  })

  it('weights recent watches more than old ones', () => {
    const week = 7 * 24 * 3_600_000
    const recent = profile({
      watched: [
        { id: 'g', at: NOW },
        { id: 'e', at: NOW - 4 * week },
      ],
    })
    expect(ids(recommendForProfile(recent))[0]).toBe('f')
    const older = profile({
      watched: [
        { id: 'g', at: NOW - 4 * week },
        { id: 'e', at: NOW },
      ],
    })
    expect(ids(recommendForProfile(older))[0]).toBe('f')
    const climate = profile({
      watched: [
        { id: 'c', at: NOW },
        { id: 'e', at: NOW - 4 * week },
      ],
    })
    expect(ids(recommendForProfile(climate))[0]).not.toBe('f')
  })

  it('spreads results over categories', () => {
    const cooking = Array.from({ length: 5 }, (_, i) =>
      make(`k${i}`, { title: `Bread Baking ${i}`, category: 'Cooking', tags: ['Bread'] }),
    )
    setCatalog([...list, ...cooking])
    const taste = profile({
      watched: [{ id: 'e', at: NOW }],
      searches: [
        { q: 'nursing', at: NOW },
        { q: 'climate', at: NOW - 1 },
      ],
    })
    const recs = recommendForProfile(taste, { limit: 6 })
    expect(recs.filter((v) => v.category === 'Cooking').length).toBeLessThanOrEqual(3)
    expect(recs.filter((v) => v.title.startsWith('Bread Baking')).length).toBeLessThanOrEqual(2)
    expect(ids(recs)).toContain('g')
    expect(ids(recs)).toContain('c')
    // The cap is soft: when nothing else matches, the list is still filled.
    const bakers = recommendForProfile(profile({ watched: [{ id: 'e', at: NOW }] }), { limit: 5 })
    expect(bakers.filter((v) => v.category === 'Cooking')).toHaveLength(5)
  })
})

describe('explain', () => {
  const [a, b, c, d, e, f, g, h] = list

  it('describes the link to the current video', () => {
    expect(explain(a, b)).toBe('Same series')
    expect(explain(a, c)).toBe('Shares topics: Climate')
    expect(explain(make('p', { title: 'Weather at Sea', category: 'Science' }), d)).toBe(
      'Also about Weather',
    )
    expect(explain(e, f)).toBe('Shares topics: Bread')
    expect(explain(make('p', { title: 'Knives', category: 'Cooking' }), f)).toBe(
      'More from Cooking',
    )
    expect(explain(h, g)).toBe('Related video')
  })

  it('falls back to the profile and stays short', () => {
    const long = make('long', {
      title: 'A Very Long Title About Bread That Keeps Going On And On Forever',
      category: 'Cooking',
      tags: ['Bread'],
    })
    setCatalog([...list, long])
    expect(explain(null, f, profile({ watched: [{ id: 'e', at: NOW }] }))).toBe(
      'Because you watched “Baking Bread at Home”',
    )
    expect(explain(null, g, profile({ searches: [{ q: 'Nursing care', at: NOW }] }))).toBe(
      'Matches your search “Nursing care”',
    )
    expect(explain(null, f, profile({ saved: ['e'] }))).toBe(
      'Because you saved “Baking Bread at Home”',
    )
    const reason = explain(null, f, profile({ watched: [{ id: 'long', at: NOW }] }))
    expect(reason.startsWith('Because you watched “A Very Long')).toBe(true)
    expect(reason.length).toBeLessThanOrEqual(60)
    expect(explain(null, g, profile({}))).toBe('More from Health')
    expect(explain(null, h)).toBe('Recommended for you')
  })
})

describe('seriesKeyOf', () => {
  it('reads the series name before a separator or episode number', () => {
    expect(seriesKeyOf('FASTLearn Episode 29 – The Connection')).toBe('fastlearn episode')
    expect(seriesKeyOf('Tech Tips 33: Logging in')).toBe('tech tips')
    expect(seriesKeyOf('Caring for the Special Child | Episode 7 (Part 5)')).toBe(
      'caring for the special child',
    )
    expect(seriesKeyOf('CEP 2017 Closing Ceremony (Part 1)')).toBe('cep 2017 closing ceremony part')
    expect(seriesKeyOf('Chronic Heart Failure: Nursing Diagnoses')).toBe('chronic heart failure')
  })

  it('ignores plain titles, hyphenated numbers and format-only prefixes', () => {
    expect(seriesKeyOf('Plain title')).toBeUndefined()
    expect(seriesKeyOf('COVID-19 and Mental Health')).toBeUndefined()
    expect(seriesKeyOf('Opening Remarks | Dr. X')).toBeUndefined()
    expect(seriesKeyOf('2nd National Conference')).toBeUndefined()
  })
})

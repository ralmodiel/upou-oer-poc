import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { videos } from '../data/catalog'
import { setNeighbors } from '../data/recs'
import { setCatalog } from '../data/testing'
import type { Video } from '../types'
import type { Profile } from './history'
import {
  explain,
  explainList,
  isNearDuplicate,
  recommendFor,
  recommendForProfile,
  seriesKeyOf,
  titleKey,
  warmRecommenderAsync,
} from './recommend'

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
        title: 'Soil Health Methods',
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
      make('w', { title: 'Soil Health Methods', category: 'Agriculture', tags: ['Soil', 'Rain'] }),
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
      make('z', { title: 'Soil Health Methods', category: 'Agriculture' }),
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
    expect(explain(a, c)).toBe('Shares a topic: Climate')
    expect(explain(make('p', { title: 'Ocean Weather at Sea', category: 'Science' }), d)).toBe(
      'Also about Ocean Weather',
    )
    // One shared title word is not a reason.
    expect(explain(make('p', { title: 'Weather at Sea', category: 'Science' }), d)).toBe(
      'More from Science',
    )
    expect(explain(e, f)).toBe('Shares a topic: Bread')
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
      'Because you watched “Baking Bread…”',
    )
    expect(explain(null, g, profile({ searches: [{ q: 'Nursing care', at: NOW }] }))).toBe(
      'Because you searched “Nursing care”',
    )
    expect(explain(null, f, profile({ saved: ['e'] }))).toBe(
      'Because you saved “Baking Bread at Home”',
    )
    const reason = explain(null, f, profile({ watched: [{ id: 'long', at: NOW }] }))
    expect(reason.startsWith('Because you watched “A Very Long')).toBe(true)
    expect(reason.length).toBeLessThanOrEqual(40)
    expect(explain(null, g, profile({}))).toBe('More from Health')
    expect(explain(null, h)).toBe('Recommended for you')
  })
})

describe('one row per talk', () => {
  const talk = 'Public Health Preparedness Amidst Pandemic: Nursing Experience'
  const health = (id: string, title: string, publishedAt = '2026-01-01T00:00:00+08:00') =>
    make(id, { title, category: 'Health', tags: ['Nursing'], publishedAt })
  const filler = [
    make('u1', { title: 'Knitting Patterns', category: 'Crafts' }),
    make('u2', { title: 'Jazz History', category: 'Music' }),
  ]

  it('shows the newest cut of a talk, keeps episodes apart and drops re-uploads', () => {
    setCatalog([
      health('q', 'Nursing in a Pandemic'),
      health('a', `${talk} | Ms. Ana Reyes, RN`),
      health('b', `${talk} | Dr. Ben Cruz`, '2026-03-01T00:00:00+08:00'),
      health('c', `Let’s Talk It Over: ${talk}`, '2026-02-01T00:00:00+08:00'),
      health('e1', 'Nursing Care | Episode 1'),
      health('e2', 'Nursing Care | Episode 2'),
      health('q2', 'Nursing in a pandemic'),
      ...filler,
    ])
    const recs = ids(recommendFor(videos[0]))
    expect(recs.filter((id) => ['a', 'b', 'c'].includes(id))).toEqual(['b'])
    expect(recs).toEqual(expect.arrayContaining(['e1', 'e2']))
    expect(recs).not.toContain('q2')
    const taste = profile({ watched: [{ id: 'e1', at: NOW }] })
    expect(ids(recommendForProfile(taste)).filter((id) => ['a', 'b', 'c'].includes(id))).toEqual([
      'b',
    ])
  })

  it('tells cuts and re-uploads from instalments', () => {
    expect(titleKey(`${talk} | Ms. Nelia A. Rafael, RN`)).toBe(titleKey(talk))
    expect(titleKey('Caring for the Special Child | Episode 5 (Part 3)')).not.toBe(
      titleKey('Caring for the Special Child | Episode 5 (Part 4)'),
    )
    const v = (title: string) => make(title, { title })
    expect(isNearDuplicate(v(`Let’s Talk It Over: ${talk}`), v(`${talk} | Dr. X`))).toBe(true)
    expect(
      isNearDuplicate(
        v('FMDS Continuing Education Program | Closing Ceremonies'),
        v('Continuing Education Program Closing Ceremonies'),
      ),
    ).toBe(true)
    expect(isNearDuplicate(v('LP Modeling (Part I)'), v('LP Modeling (Part II)'))).toBe(false)
    // A short title is the series; its guest makes the episode.
    expect(
      isNearDuplicate(v('Akdang Buhay | Dr. Jaime An Lim'), v('Akdang Buhay | Dr. Ana Cruz')),
    ).toBe(false)
  })
})

describe('recommendForProfile search slots', () => {
  // Ten loaves (no shared series name) and three nursing titles; the user watched four loaves.
  const loaves = 'Rye Flat Quick Sweet Corn Soda Milk Honey Oat Seed'.split(' ')
  const bakers = loaves.map((kind, i) =>
    make(`k${i}`, { title: `${kind} Bread Baking`, category: `Cooking ${i % 4}`, tags: ['Bread'] }),
  )
  const nurses = ['Ethics', 'Leadership', 'Informatics'].map((topic, i) =>
    make(`n${i}`, { title: `Nursing ${topic}`, category: 'Health', tags: ['Nursing'] }),
  )
  const watched = ['e', 'f', 'k0', 'k1'].map((id, i) => ({ id, at: NOW - i }))

  it('keeps two of every eight places for the latest search, within the caps', () => {
    setCatalog([...list, ...bakers, ...nurses])
    const taste = profile({ watched, searches: [{ q: 'nursing', at: NOW }] })
    const recs = recommendForProfile(taste, { limit: 8 })
    expect(recs).toHaveLength(8)
    expect(recs[1].tags).toContain('Nursing')
    expect(recs[4].tags).toContain('Nursing')
    expect(recs.filter((v) => v.category === 'Health').length).toBeLessThanOrEqual(3)
    const reasons = explainList(null, recs, taste)
    expect(reasons[1]).toBe('Because you searched “nursing”')
    expect(reasons[4]).toBe('Because you searched “nursing”')
    expect(
      recommendForProfile(taste, { limit: 4 }).filter((v) => v.tags.includes('Nursing')),
    ).toHaveLength(1)
  })

  it('reserves nothing without a search', () => {
    setCatalog([...list, ...bakers, ...nurses])
    const recs = recommendForProfile(profile({ watched }), { limit: 8 })
    expect(recs.some((v) => v.tags.includes('Nursing'))).toBe(false)
  })
})

describe('explainList', () => {
  const filler = [
    make('u1', { title: 'Knitting Patterns', category: 'Crafts' }),
    make('u2', { title: 'Jazz History', category: 'Music' }),
    make('u3', { title: 'Opera Basics', category: 'Music' }),
  ]

  it('never shows one reason on three rows in a row', () => {
    const episodes = Array.from({ length: 7 }, (_, i) =>
      make(`s${i}`, { title: `Tech Tips ${i + 1}: Topic ${i}`, category: 'Tech', tags: ['Tips'] }),
    )
    setCatalog([...episodes, ...filler])
    const [first, ...rest] = videos.slice(0, 7)
    expect(explain(first, rest[0])).toBe('Same series')
    const reasons = explainList(first, rest)
    expect(reasons).toHaveLength(6)
    for (let i = 2; i < reasons.length; i++) {
      expect(reasons[i] === reasons[i - 1] && reasons[i] === reasons[i - 2]).toBe(false)
    }
    // A reason used three times gives way to another true one ("More from Tech").
    expect(reasons.filter((r) => r === 'Same series')).toHaveLength(3)
    expect(reasons).toContain('More from Tech')
    for (const r of reasons) expect(r.length).toBeLessThanOrEqual(40)
  })

  it('names no generic words and no people', () => {
    setCatalog([
      make('a', {
        title: 'Opening Remarks by Dr. Jose Rizal',
        category: 'Events',
        tags: ['Dr. Jose Rizal'],
      }),
      make('b', {
        title: 'Closing Remarks by Dr. Jose Rizal',
        category: 'Talks',
        tags: ['Dr. Jose Rizal', 'Jose Rizal'],
      }),
      make('c', { title: 'Values and Digital Transformation', category: 'Talks' }),
      make('d', { title: 'Public Value and Digital Governance', category: 'Policy' }),
      ...filler,
    ])
    const [a, b, c, d] = videos
    expect(explain(a, b)).toBe('Same speaker')
    expect(explain(c, d)).toBe('Related video')
  })

  it('joins adjacent words into a phrase and calms shouting titles', () => {
    setCatalog([
      make('x', { title: 'CLIMATE CHANGE AND LOCAL GOVERNANCE', category: 'Policy' }),
      make('y', { title: 'Climate Change Adaptation in Cities', category: 'Science' }),
      ...filler,
    ])
    const [x, y] = videos
    expect(explain(y, x)).toBe('Also about Climate Change')
  })
})

describe('warmRecommenderAsync', () => {
  it('builds the index in steps that later calls share', async () => {
    const first = warmRecommenderAsync()
    expect(warmRecommenderAsync()).toBe(first)
    await first
    expect(ids(recommendFor(list[0]))[0]).toBe('b')
    await expect(warmRecommenderAsync()).resolves.toBeUndefined()
  })

  it('lets a synchronous call finish a build in progress', async () => {
    const pending = warmRecommenderAsync()
    expect(ids(recommendFor(list[0]))[0]).toBe('b')
    await expect(pending).resolves.toBeUndefined()
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

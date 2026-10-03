import { afterEach, describe, expect, it } from 'vitest'
import { isYouTubeId } from '../lib/youtube'
import type { Video } from '../types'
import {
  GENERAL_CATEGORY,
  getCategories,
  getCategory,
  getCategoryByName,
  getCategoryVideos,
  getFeatured,
  getLatest,
  getRows,
  getVideo,
  searchVideos,
  similarTo,
  slugifyCategory,
  summaryOf,
  videos,
} from './catalog'
import { setCatalog } from './testing'

const make = (id: string, over: Partial<Video> = {}): Video => ({
  id,
  youtubeId: 'abcdefghijk',
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

const list = [
  make('a', { category: 'Research', publishedAt: '2026-03-01', tags: ['Climate'] }),
  make('b', { category: 'Research', publishedAt: '2026-02-01', title: 'Café Économie' }),
  make('c', { category: 'Research', publishedAt: '2026-01-01', tags: ['climate'] }),
  make('d', { category: 'Arts', publishedAt: '2026-04-01', featured: true }),
  make('e', { category: 'Law', description: 'privacy policy basics' }),
]

// The shipped catalog, restored after tests that swap in fixtures.
const shipped = videos
afterEach(() => setCatalog(shipped))

describe('catalog helpers', () => {
  it('falls back to a metadata summary when the description is empty', () => {
    expect(summaryOf(list[4])).toBe('privacy policy basics')
    expect(summaryOf(list[0])).toBe(
      "An open educational video from UP Open University's Research collection. Topics: Climate.",
    )
  })

  it('ranks similar videos by category and shared tags', () => {
    expect(similarTo(list[0], list, 2).map((v) => v.id)).toEqual(['c', 'b'])
  })

  it('searches accent-insensitively and requires every term', () => {
    setCatalog(list)
    expect(searchVideos('cafe economie').map((v) => v.id)).toEqual(['b'])
    expect(searchVideos('privacy').map((v) => v.id)).toEqual(['e'])
    expect(searchVideos('privacy zzz')).toEqual([])
    expect(searchVideos('   ')).toEqual([])
  })

  it('ignores quotes and punctuation around search terms', () => {
    setCatalog(list)
    expect(searchVideos('"privacy policy"').map((v) => v.id)).toEqual(['e'])
    expect(searchVideos('climate,').map((v) => v.id)).toEqual(['a', 'c'])
    expect(searchVideos('?!')).toEqual([])
  })

  it('sorts by publish instant across time-zone offsets', () => {
    // 17:00 UTC in Manila time vs 20:00 UTC: the later-looking string is the older video.
    const manila = make('manila', { publishedAt: '2026-05-01T01:00:00+08:00' })
    const utc = make('utc', { publishedAt: '2026-04-30T20:00:00Z' })
    setCatalog([manila, utc])
    expect(getLatest().map((v) => v.id)).toEqual(['utc', 'manila'])
  })

  it('slugifies category names', () => {
    expect(slugifyCategory('Open and Distance eLearning (ODeL)')).toBe(
      'open-and-distance-elearning-odel',
    )
    expect(slugifyCategory(' Talks & Lectures ')).toBe('talks-lectures')
    expect(slugifyCategory('Café')).toBe('cafe')
  })
})

describe('catalog API', () => {
  const fixture = [
    make('a', { category: 'Research', publishedAt: '2026-03-01', title: 'Zeta' }),
    make('b', { category: 'Research', publishedAt: '2026-02-01', title: 'alpha' }),
    make('c', { category: 'Research', publishedAt: '2026-01-01', title: 'Beta 10' }),
    make('c2', { category: 'Research', publishedAt: '2025-12-01', title: 'Beta 9' }),
    make('d', { category: 'Arts & Design', publishedAt: '2026-04-01', featured: true }),
    make('d2', { category: 'Arts & Design', publishedAt: '2026-01-15' }),
    make('e', { category: 'Arts/Design', publishedAt: '2026-05-01' }),
    make('f', { category: 'Law', publishedAt: '2026-06-01', description: 'privacy policy basics' }),
    make('g1', { category: 'General', publishedAt: '2025-01-01' }),
    make('g2', { category: 'General', publishedAt: '2025-02-01' }),
    make('g3', { category: 'General', publishedAt: '2025-03-01' }),
  ]

  it('lists categories by size, with unique slugs and the newest video as cover', () => {
    setCatalog(fixture)
    expect(getCategories().map((c) => [c.slug, c.count, c.cover.id])).toEqual([
      ['research', 4, 'a'],
      ['general', 3, 'g3'],
      ['arts-design', 2, 'd'],
      ['arts-design-2', 1, 'e'],
      ['law', 1, 'f'],
    ])
    expect(getCategory('arts-design-2')?.name).toBe('Arts/Design')
    expect(getCategory('nope')).toBeUndefined()
  })

  it('finds a category by its exact name, even when its slug carries a suffix', () => {
    setCatalog(fixture)
    expect(getCategoryByName('Arts/Design')?.slug).toBe('arts-design-2')
    expect(getCategoryByName('Arts & Design')?.slug).toBe('arts-design')
    expect(getCategoryByName('arts-design')).toBeUndefined()
    expect(getCategoryByName('Nope')).toBeUndefined()
  })

  it('sorts category videos by date or title', () => {
    setCatalog(fixture)
    const ids = (sort?: 'newest' | 'oldest' | 'title') =>
      getCategoryVideos('research', sort).map((v) => v.id)
    expect(ids()).toEqual(['a', 'b', 'c', 'c2'])
    expect(ids('oldest')).toEqual(['c2', 'c', 'b', 'a'])
    expect(ids('title')).toEqual(['b', 'c2', 'c', 'a'])
    expect(getCategoryVideos('nope')).toEqual([])
    expect(getCategoryVideos('research')).toBe(getCategoryVideos('research'))
  })

  it('keeps catalog order for equal publish times in both date sorts', () => {
    const same = '2026-01-01T00:00:00+08:00'
    setCatalog([
      make('x1', { publishedAt: same }),
      make('x2', { publishedAt: same }),
      make('x3', { publishedAt: '2026-02-01T00:00:00+08:00' }),
    ])
    expect(getCategoryVideos('misc', 'newest').map((v) => v.id)).toEqual(['x3', 'x1', 'x2'])
    expect(getCategoryVideos('misc', 'oldest').map((v) => v.id)).toEqual(['x1', 'x2', 'x3'])
  })

  it('builds capped home rows for categories with three or more videos, skipping General', () => {
    setCatalog(fixture)
    expect(getRows(2)).toEqual([
      {
        id: 'cat-research',
        slug: 'research',
        title: 'Research',
        count: 4,
        videos: [fixture[0], fixture[1]],
      },
    ])
    expect(getRows()[0].videos).toHaveLength(4)
  })

  it('picks featured and latest videos', () => {
    setCatalog(fixture)
    expect(getFeatured().map((v) => v.id)).toEqual(['d', 'f', 'e', 'a', 'b'])
    expect(getLatest(2).map((v) => v.id)).toEqual(['f', 'e'])
    expect(getLatest()).toHaveLength(11)
  })

  it('filters search results by category name or slug', () => {
    setCatalog(fixture)
    expect(searchVideos('beta').map((v) => v.id)).toEqual(['c', 'c2'])
    expect(searchVideos('beta', { category: 'research', limit: 1 }).map((v) => v.id)).toEqual(['c'])
    expect(searchVideos('beta', { category: 'Research' })).toHaveLength(2)
    expect(searchVideos('privacy', { category: 'research' })).toEqual([])
    expect(searchVideos('beta', { category: 'nope' })).toEqual([])
  })

  it('swaps the catalog for fixtures, slim records included', () => {
    setCatalog(fixture)
    expect(videos).toHaveLength(fixture.length)
    expect(getVideo('f')?.title).toBe('f')
    expect(getVideo('nope')).toBeUndefined()
    setCatalog([{ id: 'slim', y: 'abcdefghijk', t: 'Slim', c: 'Misc', p: '2026-01-01' }])
    const slim = getVideo('slim')!
    expect(slim.thumbnails?.[0]).toBe('https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg')
    expect(slim.thumbnails).toContain(slim.thumbnail)
    expect(getCategories().map((c) => c.slug)).toEqual(['misc'])
  })
})

describe('shipped catalog', () => {
  it('is well formed', () => {
    // Image hosts must match img-src in the CSP (vite.config.ts).
    const imageHosts = ['i.ytimg.com', 'oer.upou.edu.ph']
    expect(videos.length).toBeGreaterThan(100)
    expect(new Set(videos.map((v) => v.id)).size).toBe(videos.length)
    expect(new Set(videos.map((v) => v.youtubeId)).size).toBe(videos.length)
    for (const v of videos) {
      expect(isYouTubeId(v.youtubeId), v.id).toBe(true)
      expect(v.title.trim(), v.id).not.toBe('')
      expect(v.category.trim(), v.id).not.toBe('')
      expect(Date.parse(v.publishedAt), v.id).not.toBeNaN()
      expect(new URL(v.sourceUrl).origin, v.id).toBe('https://oer.upou.edu.ph')
      for (const src of [v.thumbnail, v.backdrop, ...v.frames]) {
        const url = new URL(src)
        expect(url.protocol === 'https:' && imageHosts.includes(url.hostname), src).toBe(true)
      }
    }
  })

  it('has home rows and distinct category slugs', () => {
    expect(getRows().length).toBeGreaterThan(3)
    for (const row of getRows()) expect(row.videos.length).toBeLessThanOrEqual(8)
    expect(getRows().some((r) => r.title === GENERAL_CATEGORY)).toBe(false)
    expect(getCategoryByName(GENERAL_CATEGORY)?.slug).toBe('general')
    const slugs = getCategories().map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(getFeatured()).toHaveLength(5)
  })
})

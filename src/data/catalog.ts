import records from './catalog.json'
import type { Video } from '../types'
import { expandCatalog } from './expand'

export interface Row {
  id: string
  title: string
  videos: readonly Video[]
}

/** A home section for one category; `videos` is capped, `count` is the category total. */
export interface CategoryRow extends Row {
  slug: string
  count: number
}

export interface Category {
  slug: string
  name: string
  count: number
  /** The newest video in the category. */
  cover: Video
}

export type CategorySort = 'newest' | 'oldest' | 'title'

export interface SearchOptions {
  /** Category name or slug. */
  category?: string
  limit?: number
}

export interface IndexedVideo {
  v: Video
  title: string
  meta: string
  body: string
}

/** The crawler's bucket for posts without a category: browsable, but not a home section. */
export const GENERAL_CATEGORY = 'General'
const MIN_ROW_SIZE = 3
const LEGACY_ROW_CAP = 24

// The catalog is static, so derived collections are memoized and only tests swap the data
// (see testing.ts). These are live bindings: importers see the swap.
export let videos: readonly Video[] = []
export let featured: Video[] = []
export let latest: Video[] = []
export let rows: Row[] = []
export let categories: string[] = []
let byId = new Map<string, Video>()
let memo = new Map<string, unknown>()

const cached = <T>(key: string, compute: () => T): T => {
  if (!memo.has(key)) memo.set(key, compute())
  return memo.get(key) as T
}

export const getVideo = (id?: string | null): Video | undefined => (id ? byId.get(id) : undefined)

// Publish instants are parsed once per video so sorting stays cheap (and mixed offsets sort right).
const stamps = new WeakMap<Video, number>()
function stamp(v: Video): number {
  let t = stamps.get(v)
  if (t === undefined) {
    t = Date.parse(v.publishedAt)
    stamps.set(v, t)
  }
  return t
}
const newestFirst = (a: Video, b: Video) => stamp(b) - stamp(a)
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
const byTitle = (a: Video, b: Video) => collator.compare(a.title, b.title)

export const slugifyCategory = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

interface Group {
  slug: string
  name: string
  videos: Video[]
}

/** Videos grouped by category (catalog order), keyed by slug. */
function groups(): Map<string, Group> {
  return cached('groups', () => {
    const bySlug = new Map<string, Group>()
    const byName = new Map<string, Group>()
    for (const v of videos) {
      let group = byName.get(v.category)
      if (!group) {
        // names that differ only in punctuation must not share a slug
        const base = slugifyCategory(v.category) || 'other'
        let slug = base
        for (let n = 2; bySlug.has(slug); n++) slug = `${base}-${n}`
        group = { slug, name: v.category, videos: [] }
        byName.set(v.category, group)
        bySlug.set(slug, group)
      }
      group.videos.push(v)
    }
    return bySlug
  })
}

/** All categories, largest first. */
export function getCategories(): Category[] {
  return cached('categories', () =>
    [...groups().values()]
      .sort((a, b) => b.videos.length - a.videos.length || a.name.localeCompare(b.name))
      .map(({ slug, name, videos: list }) => ({
        slug,
        name,
        count: list.length,
        cover: getCategoryVideos(slug)[0],
      })),
  )
}

export function getCategory(slug: string): Category | undefined {
  return cached('categoryBySlug', () => new Map(getCategories().map((c) => [c.slug, c]))).get(slug)
}

/** The videos of one category. Results are shared and memoized: do not mutate them. */
export function getCategoryVideos(slug: string, sort: CategorySort = 'newest'): Video[] {
  return cached(`category:${slug}:${sort}`, () => {
    const list = groups().get(slug)?.videos ?? []
    if (sort === 'title') return [...list].sort(byTitle)
    if (sort === 'oldest') return [...getCategoryVideos(slug)].reverse()
    return [...list].sort(newestFirst)
  })
}

/** Home sections: one per category with at least three videos, largest first, each capped. */
export function getRows(capPerRow = 8): CategoryRow[] {
  return cached(`rows:${capPerRow}`, () =>
    getCategories()
      .filter((c) => c.count >= MIN_ROW_SIZE && c.name !== GENERAL_CATEGORY)
      .map((c) => ({
        id: `cat-${c.slug}`,
        slug: c.slug,
        title: c.name,
        count: c.count,
        videos: getCategoryVideos(c.slug).slice(0, capPerRow),
      })),
  )
}

/** Five videos: the featured ones first, then the newest. */
export function getFeatured(): Video[] {
  return cached('featured', () => pickFeatured(videos, 5))
}

export function getLatest(limit = 12): Video[] {
  return cached(`latest:${limit}`, () => newest(videos, limit))
}

/** Featured items first, then newest. */
export function pickFeatured(list: readonly Video[], limit = 5): Video[] {
  return [...list]
    .sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || newestFirst(a, b))
    .slice(0, limit)
}

export function newest(list: readonly Video[], limit = 12): Video[] {
  return [...list].sort(newestFirst).slice(0, limit)
}

/** One row per category with enough titles; small categories are pooled into "More to Explore". */
export function categoryRows(list: readonly Video[], minSize = MIN_ROW_SIZE): Row[] {
  const groups = new Map<string, Video[]>()
  for (const v of list) {
    const group = groups.get(v.category)
    if (group) group.push(v)
    else groups.set(v.category, [v])
  }
  const rows: Row[] = []
  const rest: Video[] = []
  for (const [title, items] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    if (items.length >= minSize)
      rows.push({ id: `cat-${slugifyCategory(title)}`, title, videos: items })
    else rest.push(...items)
  }
  if (rest.length >= minSize) rows.push({ id: 'more', title: 'More to Explore', videos: rest })
  return rows
}

/** The description, or a short summary from metadata (most source pages have no description). */
export function summaryOf(v: Video): string {
  if (v.description) return v.description
  const topics = v.tags.slice(0, 3).join(' · ')
  return `An open educational video from ${v.channel}'s ${v.category} collection.${topics ? ` Topics: ${topics}.` : ''}`
}

/** Ranks other videos by shared category and tags. */
export function similarTo(video: Video, list: readonly Video[] = videos, limit = 9): Video[] {
  const tags = new Set(video.tags.map((t) => t.toLowerCase()))
  return list
    .filter((v) => v.id !== video.id)
    .map((v) => ({
      v,
      score:
        (v.category === video.category ? 3 : 0) +
        v.tags.filter((t) => tags.has(t.toLowerCase())).length,
    }))
    .sort((a, b) => b.score - a.score || newestFirst(a.v, b.v))
    .slice(0, limit)
    .map((x) => x.v)
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export const buildIndex = (list: readonly Video[]): IndexedVideo[] =>
  list.map((v) => ({
    v,
    title: normalize(v.title),
    meta: normalize(`${v.category} ${v.tags.join(' ')} ${v.channel}`),
    body: normalize(v.description),
  }))

const isIndex = (x: readonly IndexedVideo[] | SearchOptions): x is readonly IndexedVideo[] =>
  Array.isArray(x)

/**
 * Every term must match; title hits outrank tag/category hits, which outrank description hits.
 * The second argument is either options or a prebuilt index (the original signature).
 */
export function searchVideos(
  query: string,
  indexOrOptions: readonly IndexedVideo[] | SearchOptions = {},
  limit = 60,
): Video[] {
  const legacy = isIndex(indexOrOptions)
  // the default index is built on the first search
  const index = legacy ? indexOrOptions : cached('index', () => buildIndex(videos))
  const { category, limit: max = limit } = legacy ? {} : indexOrOptions
  const wanted = category ? (getCategory(category)?.name ?? category) : undefined
  // Edge punctuation is dropped so quoted or comma-separated queries still match.
  const terms = normalize(query)
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean)
  if (!terms.length) return []
  const hits: { v: Video; score: number }[] = []
  for (const { v, title, meta, body } of index) {
    if (wanted && v.category !== wanted) continue
    let score = 0
    for (const t of terms) {
      const s = title.includes(t) ? 5 : meta.includes(t) ? 3 : body.includes(t) ? 1 : 0
      if (!s) {
        score = 0
        break
      }
      score += s
    }
    if (score) hits.push({ v, score })
  }
  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((h) => h.v)
}

/** Installs a catalog and resets everything derived from it. Tests: use setCatalog in testing.ts. */
export function replaceCatalog(list: readonly Video[]): void {
  videos = list
  byId = new Map(list.map((v) => [v.id, v]))
  memo = new Map()
  featured = getFeatured()
  latest = getLatest()
  // the original home rows; capped so a whole category never renders in one strip
  rows = categoryRows(list).map((r) =>
    r.videos.length > LEGACY_ROW_CAP ? { ...r, videos: r.videos.slice(0, LEGACY_ROW_CAP) } : r,
  )
  categories = [...new Set(list.map((v) => v.category))].sort()
}

replaceCatalog(expandCatalog(records))

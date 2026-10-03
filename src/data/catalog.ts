import records from './catalog.json'
import { formatDate } from '../lib/format'
import { isOrgTag, registerNameTokens, topicTags } from '../lib/tags'
import type { Video } from '../types'
import { DEFAULT_CHANNEL, expandCatalog } from './expand'
import { frameFlagsOf } from './frameFlags'
import { isCleanImage } from './images'

/** Whether the video's canonical image passes the frame filter (it fails only when all do). */
export const hasCleanPoster = (v: Video) =>
  !!v.poster && isCleanImage(frameFlagsOf(v.youtubeId), v.poster)

/** A home section for one category; `videos` is capped, `count` is the category total. */
export interface CategoryRow {
  id: string
  slug: string
  title: string
  count: number
  videos: readonly Video[]
}

export interface Category {
  slug: string
  name: string
  count: number
  /** The newest video in the category. */
  cover: Video
  /** The newest video with an image the frame filter passes, for link previews. */
  preview?: Video
}

export type CategorySort = 'newest' | 'oldest' | 'title'

export interface SearchOptions {
  /** Category name or slug. */
  category?: string
  limit?: number
}

interface IndexedVideo {
  v: Video
  title: string
  meta: string
  body: string
}

/** The crawler's bucket for posts without a category: browsable, but not a home section. */
export const GENERAL_CATEGORY = 'General'
const MIN_ROW_SIZE = 3

// The catalog is static, so derived collections are memoized and only tests swap the data
// (see testing.ts). `videos` is a live binding: importers see the swap.
export let videos: readonly Video[] = []
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
const oldestFirst = (a: Video, b: Video) => stamp(a) - stamp(b)
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
const byTitle = (a: Video, b: Video) => collator.compare(a.title, b.title)

/** The whole catalog, newest first. Shared and memoized: do not mutate. */
const byDate = () => cached('byDate', () => [...videos].sort(newestFirst))

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

const isGeneral = (name: string) => Number(name === GENERAL_CATEGORY)

/**
 * All categories, largest first, or with `'latest'` the one with the newest video first (the home);
 * General (posts without a subject) last either way.
 */
export function getCategories(order: 'size' | 'latest' = 'size'): Category[] {
  const newestOf = (slug: string) => getCategoryVideos(slug)[0]
  return cached(`categories:${order}`, () =>
    [...groups().values()]
      .sort(
        (a, b) =>
          isGeneral(a.name) - isGeneral(b.name) ||
          (order === 'latest' ? newestFirst(newestOf(a.slug), newestOf(b.slug)) : 0) ||
          b.videos.length - a.videos.length ||
          a.name.localeCompare(b.name),
      )
      .map(({ slug, name, videos: list }) => ({
        slug,
        name,
        count: list.length,
        cover: getCategoryVideos(slug)[0],
        preview: getCategoryVideos(slug).find(hasCleanPoster),
      })),
  )
}

export function getCategory(slug: string): Category | undefined {
  return cached('categoryBySlug', () => new Map(getCategories().map((c) => [c.slug, c]))).get(slug)
}

/** By exact name. Slugs can carry a "-2" suffix, so never slugify a name to find its category. */
export function getCategoryByName(name: string): Category | undefined {
  return cached('categoryByName', () => new Map(getCategories().map((c) => [c.name, c]))).get(name)
}

/** The videos of one category. Results are shared and memoized: do not mutate them. */
export function getCategoryVideos(slug: string, sort: CategorySort = 'newest'): Video[] {
  return cached(`category:${slug}:${sort}`, () => {
    const list = groups().get(slug)?.videos ?? []
    const compare = sort === 'title' ? byTitle : sort === 'oldest' ? oldestFirst : newestFirst
    return [...list].sort(compare)
  })
}

/**
 * Home sections: one per category with at least three videos, the one with the newest video
 * first, each capped.
 */
export function getRows(capPerRow = 8): CategoryRow[] {
  return cached(`rows:${capPerRow}`, () =>
    getCategories('latest')
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
  return cached('featured', () =>
    [...byDate()].sort((a, b) => Number(!!b.featured) - Number(!!a.featured)).slice(0, 5),
  )
}

export function getLatest(limit = 12): Video[] {
  return cached(`latest:${limit}`, () => byDate().slice(0, limit))
}

/**
 * The description, or else a line of facts (most source pages have no description):
 * "Mar 1, 2026 · Research · Climate, Rainfall".
 */
export function summaryOf(v: Video): string {
  if (v.description) return v.description
  const topics = topicTags(v.tags)
    .filter((t) => !isOrgTag(t))
    .slice(0, 2)
  return [
    formatDate(v.publishedAt),
    v.category === GENERAL_CATEGORY ? '' : v.category,
    topics.join(', '),
  ]
    .filter(Boolean)
    .join(' · ')
}

export interface Fact {
  label: string
  /** Route for the collection fact. */
  to?: string
  /** ISO instant for the publish-date fact. */
  dateTime?: string
}

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`

/**
 * What is known about a video, for a meta line: "Published Nov 25, 2024",
 * "Health Sciences (165 videos)", "UP Open University". Most source pages have no description.
 */
export function factsOf(v: Video): Fact[] {
  const facts: Fact[] = []
  const date = formatDate(v.publishedAt)
  if (date) facts.push({ label: `Published ${date}`, dateTime: v.publishedAt })
  const category = getCategoryByName(v.category)
  facts.push(
    category
      ? {
          label: `${category.name} (${plural(category.count, 'video')})`,
          to: `/collections/${category.slug}`,
        }
      : { label: v.category },
  )
  facts.push({ label: v.channel || DEFAULT_CHANNEL })
  return facts
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

// Built on the first search.
const index = () =>
  cached('index', (): IndexedVideo[] =>
    videos.map((v) => ({
      v,
      title: normalize(v.title),
      meta: normalize(`${v.category} ${v.tags.join(' ')} ${v.channel}`),
      body: normalize(v.description),
    })),
  )

/** Every term must match; title hits outrank tag/category hits, which outrank description hits. */
export function searchVideos(query: string, { category, limit = 60 }: SearchOptions = {}): Video[] {
  const wanted = category ? (getCategory(category)?.name ?? category) : undefined
  // Edge punctuation is dropped so quoted or comma-separated queries still match.
  const terms = normalize(query)
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean)
  if (!terms.length) return []
  const hits: { v: Video; score: number }[] = []
  for (const { v, title, meta, body } of index()) {
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
    .slice(0, limit)
    .map((h) => h.v)
}

/** Installs a catalog and forgets everything derived from it. Tests: use setCatalog in testing.ts. */
export function replaceCatalog(list: readonly Video[]): void {
  videos = list
  // Read only when a page first asks about names (watch page, quick look, recommendations).
  registerNameTokens(() => list)
  byId = new Map(list.map((v) => [v.id, v]))
  memo = new Map()
}

replaceCatalog(expandCatalog(records))

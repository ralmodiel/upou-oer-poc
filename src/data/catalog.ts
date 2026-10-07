import catalogNames from 'virtual:catalog-names'
import files from 'virtual:catalog-files'
import summary from 'virtual:catalog-home'
import { formatDate } from '../lib/format'
import {
  buildVocabulary,
  correctionOf,
  countWords,
  EXACT,
  matchTier,
  maxEdits,
  NEAR,
  nearWords,
  normalize,
  vocabularyOf,
  wordsOf,
  type Term,
} from '../lib/fuzzy'
import {
  isNameToken,
  isOrgTag,
  registerNameTokens,
  registerPersonKeys,
  topicTags,
  type LearnedNames,
} from '../lib/tags'
import { whenImagesSettled } from '../components/browse-hooks'
import { readProfile } from '../lib/history'
import type { CatalogRecord, Video } from '../types'
import { DEFAULT_CHANNEL, expandRecord } from './expand'
import { addFrameFlags, frameFlagsOf } from './frameFlags'
import { isCleanImage } from './images'
import { unpackRecords, type CatalogPack } from './pack'
import { addSpeakers } from './speakers'
import { chunkOf, HOME, ROW_POOL, type CatalogPart, type HomeSummary } from './split'

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
  /** Match titles only (suggestions). */
  titles?: boolean
}

export interface SearchResults {
  videos: Video[]
  /** How many match every word as typed; the rest match a word only by a near spelling. */
  exact: number
  /** The query with misspelt words fixed ("nutrition"), when the fix is used more. */
  correction?: string
}

// Each field as a run of words (see wordsOf).
interface IndexedVideo {
  v: Video
  title: string
  meta: string
  body: string
}

/** The crawler's bucket for posts without a category: browsable, but not a home section. */
export const GENERAL_CATEGORY = 'General'
const MIN_ROW_SIZE = 3
// The newest videos the summary holds, which is what getLatest reads for the home.
const HOME_LATEST = 12

// The catalog is static, so derived collections are memoized and only tests swap the data
// (see testing.ts). `videos` is a live binding: importers see the swap.
export let videos: readonly Video[] = []
let byId = new Map<string, Video>()
let memo = new Map<string, unknown>()
// Set while only the home summary's videos (and what was fetched since) are in: the whole catalog's
// counts, its other videos still on the way. Everything derived (memo) then reads the summary's
// videos alone, which is all the home's first screen shows.
let partial: Pick<HomeSummary, 'total' | 'categories'> | undefined
let complete = false

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
  /** The category's size when only some of its videos are in. */
  size?: number
}

const sizeOf = (g: Group) => g.size ?? g.videos.length

/** Videos grouped by category (catalog order), keyed by slug. */
function groups(): Map<string, Group> {
  return cached('groups', () => {
    const bySlug = new Map<string, Group>()
    const byName = new Map<string, Group>()
    for (const [name, slug, size] of partial?.categories ?? []) {
      const group = { slug, name, videos: [], size }
      byName.set(name, group)
      bySlug.set(slug, group)
    }
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
          sizeOf(b) - sizeOf(a) ||
          a.name.localeCompare(b.name),
      )
      .map((group) => {
        const { slug, name } = group
        const newest = getCategoryVideos(slug)
        let preview: Video | undefined
        // Only link previews read it, and finding it works out images: on first read.
        return Object.defineProperty(
          { slug, name, count: sizeOf(group), cover: newest[0] } as Category,
          'preview',
          { enumerable: true, get: () => (preview ??= newest.find(hasCleanPoster)) },
        )
      }),
  )
}

export function getCategory(slug: string): Category | undefined {
  return cached('categoryBySlug', () => new Map(getCategories().map((c) => [c.slug, c]))).get(slug)
}

/** By exact name. Slugs can carry a "-2" suffix, so never slugify a name to find its category. */
export function getCategoryByName(name: string): Category | undefined {
  return cached('categoryByName', () => new Map(getCategories().map((c) => [c.name, c]))).get(name)
}

/**
 * A category's newest videos, newest first: all of them, or while only some videos are in, the ones
 * that are (the first POOL_CATEGORY are right once the pool has arrived, see split.ts).
 */
export function getCategoryNewest(slug: string): Video[] {
  if (!partial) return getCategoryVideos(slug)
  const name = groups().get(slug)?.name
  return newestLoaded(Infinity).filter((v) => v.category === name)
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
  // Only the first twelve are the summary's; the pool (see split.ts) holds the newest sixteen.
  if (partial && limit > HOME_LATEST) return newestLoaded(limit)
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

const indexed = (v: Video): IndexedVideo => ({
  v,
  title: wordsOf(v.title),
  meta: wordsOf(`${v.category} ${v.tags.join(' ')} ${v.channel}`),
  body: wordsOf(v.description),
})

// Built on the first search, or ahead of it (see searchWarmup and warmSearch).
const index = () => cached('index', () => videos.map(indexed))

// Words of titles, tags, collections and channel, for near spellings; people's names left out.
const vocabulary = () =>
  cached('vocabulary', () =>
    buildVocabulary(
      index().map(({ title, meta }) => title + meta),
      isNameToken,
    ),
  )

// A word in fewer videos than this, as typed, also matches near spellings.
const FEW_HITS = 3

const hitsOf = (word: string) => {
  let hits = 0
  for (const { title, meta, body } of index()) {
    if (title.includes(word) || meta.includes(word) || body.includes(word)) {
      if (++hits >= FEW_HITS) break
    }
  }
  return hits
}

/** A query's words, each with the near spellings it may stand for when it is rare as typed. */
export function queryTerms(query: string): Term[] {
  const last = memo.get('terms') as { query: string; terms: Term[] } | undefined
  if (last?.query === query) return last.terms
  const terms = normalize(query)
    .split(/\s+/)
    // Edge punctuation is dropped so quoted or comma-separated queries still match; inside a
    // word it splits it as in the index ("covid-19" → "covid 19").
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' '))
    .filter(Boolean)
    .map((word): Term => {
      const hits = maxEdits(word) ? hitsOf(word) : FEW_HITS
      if (hits >= FEW_HITS) return { word, near: [] }
      // A misspelling is rarer than the word meant: "beta" (2 videos) never means "zeta" (1).
      const near = nearWords(vocabulary(), word).filter((n) => n.count > hits)
      return { word, near: near.map((n) => n.word) }
    })
  memo.set('terms', { query, terms })
  return terms
}

/**
 * Every term must match, as typed or (a word rare as typed) by a near spelling. Title hits outrank
 * tag/category hits, which outrank description hits; within a field the whole word beats the
 * start of a word, then a part of one, then a near spelling.
 */
export function searchCatalog(
  query: string,
  { category, limit = 60, titles = false }: SearchOptions = {},
): SearchResults {
  const wanted = category ? (getCategory(category)?.name ?? category) : undefined
  const terms = queryTerms(query)
  if (!terms.length) return { videos: [], exact: 0 }
  const hits: { v: Video; score: number }[] = []
  let exact = 0
  // One letter or digit ("R", the "C" of "C++", the "1" of "#1") is in nearly every field, so on
  // the results page it counts only as a whole word. Suggestions still take it as a word start.
  const tier = (field: string, t: Term) =>
    t.word.length > 1 ? matchTier(field, t) : field.includes(` ${t.word} `) ? EXACT : 0
  for (const { v, title, meta, body } of index()) {
    if (wanted && v.category !== wanted) continue
    let score = 0
    let typed = true
    for (const t of terms) {
      const a = tier(title, t)
      const b = titles ? 0 : tier(meta, t)
      const c = titles ? 0 : tier(body, t)
      if (!a && !b && !c) {
        score = 0
        break
      }
      // Field weights: title 5, collection, tags and channel 3, description 1.
      score += Math.max(a * 5, b * 3, c)
      if (Math.max(a, b, c) === NEAR) typed = false
    }
    if (!score) continue
    hits.push({ v, score })
    if (typed) exact++
  }
  return {
    videos: hits
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((h) => h.v),
    exact,
    correction: correctionOf(terms),
  }
}

/** The videos searchCatalog finds. */
export const searchVideos = (query: string, options?: SearchOptions): Video[] =>
  searchCatalog(query, options).videos

/** Builds the search index and the spelling vocabulary ahead of a first search. */
export function warmSearch(): void {
  vocabulary()
}

// Videos per warm-up step: a few hundredths of a millisecond each, so a slice can stop on time.
const WARM_STEP = 20

/**
 * warmSearch a few videos per step, for a caller to spread over idle time: it yields between
 * steps and stops if the catalog is replaced.
 */
export function* searchWarmup(): Generator<void, void> {
  const at = memo
  // Runs `each` over `list`, a step at a time; false when the catalog was replaced meanwhile.
  function* steps<T>(list: readonly T[], each: (item: T) => void): Generator<void, boolean> {
    for (let i = 0; i < list.length; i++) {
      each(list[i])
      if (i % WARM_STEP === WARM_STEP - 1) {
        yield
        if (memo !== at) return false
      }
    }
    return true
  }
  if (!memo.has('index')) {
    const list: IndexedVideo[] = []
    if (!(yield* steps(videos, (v) => list.push(indexed(v))))) return
    cached('index', () => list)
  }
  if (!memo.has('vocabulary')) {
    const counts = new Map<string, number>()
    if (!(yield* steps(index(), ({ title, meta }) => countWords(counts, title + meta)))) return
    // The name test is the slow part of the last step, so it gets steps of its own.
    const names = new Set<string>()
    const keep = (word: string) => void (isNameToken(word) && names.add(word))
    if (!(yield* steps([...counts.keys()], keep))) return
    cached('vocabulary', () => vocabularyOf(counts, (word) => names.has(word)))
  }
  mark('search:indexed')
}

/** Installs a catalog and forgets everything derived from it. Tests: use setCatalog in testing.ts. */
export function replaceCatalog(list: readonly Video[], names?: LearnedNames): void {
  partial = undefined
  complete = true
  loaded.clear()
  videos = list
  // The names its tags teach, learned by the build; for other lists, read only when a page first
  // asks about names (watch page, quick look, recommendations).
  registerNameTokens(names ?? (() => list))
  byId = new Map(list.map((v) => [v.id, v]))
  memo = new Map()
}

/** A mark on the performance timeline: when each part arrived, was parsed, and was indexed. */
export const mark = (name: string) => typeof performance !== 'undefined' && performance.mark?.(name)

/** Videos in the whole catalog, also while only the home summary's are in. */
export const videoCount = (): number => partial?.total ?? videos.length

/** Whether every video is in (else only the home summary's and what was fetched since). */
export const isCatalogComplete = (): boolean => complete

// The summary's videos, then each file's as it arrives, by position in the whole catalog. A
// video's object is the one handed out already, so a card keeps its video when the rest arrives.
const loaded = new Map<number, Video>()
let loadedList: { size: number; list: Video[] } | undefined

/** The videos in so far, in catalog order. */
function loadedVideos(): Video[] {
  if (loadedList?.size !== loaded.size)
    loadedList = {
      size: loaded.size,
      list: [...loaded.keys()].sort((a, b) => a - b).map((at) => loaded.get(at)!),
    }
  return loadedList.list
}

/** The newest `limit` of the videos in so far; right up to the pool's size once it is in. */
function newestLoaded(limit: number): Video[] {
  return [...loadedVideos()].sort(newestFirst).slice(0, limit)
}

// The build checked every record (src/data/split.ts), so they expand without checks.
function expandPart(part: CatalogPack): Video[] {
  addFrameFlags(part)
  addSpeakers(part)
  return (unpackRecords(part) as CatalogRecord[]).map(expandRecord)
}

const fetched: (Promise<void> | undefined)[] = files.map(() => undefined)
let arrived = 0
let settle = () => {}
const whole = new Promise<void>((resolve) => (settle = resolve))

function addFile(i: number, part: CatalogPart): void {
  if (complete) return
  mark(`catalog:arrived:${i}`)
  const list = expandPart(part)
  list.forEach((v, j) => {
    loaded.set(part.at[j], v)
    byId.set(v.id, v)
  })
  mark(`catalog:parsed:${i}`)
  if (++arrived === files.length) {
    // Whole: in catalog order, as expandCatalog gave it. What the home shows keeps its identity.
    const keep = ['featured', `latest:${HOME_LATEST}`].map((key) => [key, memo.get(key)] as const)
    replaceCatalog(loadedVideos().slice(), catalogNames)
    for (const [key, old] of keep) {
      const now = memo.get(key) as Video[] | undefined
      if (old && now && (old as Video[]).every((v, k) => v === now[k])) memo.set(key, old)
    }
    mark('catalog:complete')
    settle()
  }
}

// Per attempt, the download included: a slow phone link takes seconds for a file, not this long.
const FILE_TIMEOUT_MS = 20_000

/** File `i`, fetched once (again after a failure). */
function loadFile(i: number, low = false): Promise<void> {
  return (fetched[i] ??= (async () => {
    mark(`catalog:requested:${i}`)
    try {
      // A blip (a 5xx, a dropped connection) is retried twice before the page gives up: the
      // router's loader and the early prefetch share this one request.
      for (let attempt = 0; ; attempt++) {
        // A request that never answers is cut off too, so it reaches the retry and the error page.
        const abort = new AbortController()
        const timer = setTimeout(() => abort.abort(), FILE_TIMEOUT_MS)
        try {
          const res = await fetch(files[i], {
            signal: abort.signal,
            ...(low ? ({ priority: 'low' } as RequestInit) : {}),
          })
          if (!res.ok) throw new Error(`catalog file ${i}: ${res.status}`)
          const body = await res.text()
          mark(`catalog:body:${i}`)
          addFile(i, JSON.parse(body) as CatalogPart)
          break
        } catch (error) {
          if (attempt === 2) throw error
          await new Promise((resolve) => setTimeout(resolve, 400 * 3 ** attempt))
        } finally {
          clearTimeout(timer)
        }
      }
    } catch (error) {
      fetched[i] = undefined
      throw error
    }
  })())
}

/** Fetches every file not in yet, at once; resolves when the whole catalog is installed. */
function loadAll(): Promise<void> {
  if (complete) return Promise.resolve()
  return Promise.all(files.map((_, i) => loadFile(i))).then(() => whole)
}

/** Resolves once every video is in: the background fetch (trickle) brings them, or a page's own. */
export const catalogComplete = (): Promise<void> => (complete ? Promise.resolve() : whole)

const POOL = 0

/**
 * What a page of these videos reads (see split.ts): the file of each one not in yet and, for a
 * watch page (`pool`), the pool beside them. Without `pool` the pool is asked for only if a video
 * is still missing then: it is in no file of its own, but most are.
 */
async function loadVideos(ids: readonly string[], pool: boolean): Promise<void> {
  if (complete) return
  const missing = ids.filter((id) => !byId.has(id))
  const own = new Set(missing.map((id) => chunkOf(id, files.length - 1)))
  await Promise.all([...(pool ? [POOL] : []), ...own].map((i) => loadFile(i)))
  if (!pool && missing.some((id) => !byId.has(id))) await loadFile(POOL)
}

/**
 * Whether the home reads the same from the summary as from the whole catalog, given what this
 * browser watched (BrowsePage): each collection row still fills its cards (HOME.rowCards) from the
 * summary's newest ROW_POOL after leaving out the titles above it: the five featured, the four
 * "Also new" and the recently viewed.
 */
function homeFits(watched: readonly string[]): boolean {
  const featured = getFeatured().map((v) => v.id)
  const above = new Set(featured)
  getLatest(HOME.latest)
    .filter((v) => !above.has(v.id))
    .slice(0, 4)
    .forEach((v) => above.add(v.id))
  watched.forEach((id) => above.add(id))
  return getRows(ROW_POOL)
    .filter((row) => row.count >= HOME.rowMin)
    .slice(0, HOME.rows)
    .every((row) => row.videos.filter((v) => !above.has(v.id)).length >= HOME.rowCards)
}

const WATCH = /^\/watch\/([^/]+)\/?$/

// A malformed escape ("/watch/50%") stays as typed: no video has that id, so the page says so.
const safeDecode = (s: string): string => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/**
 * What a page must wait for before it renders (the router's loader), if anything. The home renders
 * from the summary, once the videos in this browser's history are in and the rows are the same
 * without the rest (homeFits), else it waits for all; a watch page or a quick look needs its own
 * video (and the pool for a watch page); every other page waits for all.
 */
export function catalogWait(pathname: string, search: string): Promise<void> | undefined {
  if (complete) return undefined
  if (pathname === '/') {
    const quickLook = new URLSearchParams(search).get('v')
    const watched = readProfile().watched.map((e) => e.id)
    const wanted = quickLook ? [...watched, quickLook] : watched
    const fits = () => (homeFits(watched) ? undefined : loadAll())
    if (wanted.every((id) => byId.has(id))) return fits()
    return loadVideos(wanted, false).then(fits)
  }
  const watch = WATCH.exec(pathname)
  return watch ? loadVideos([safeDecode(watch[1])], true) : loadAll()
}

// The route path under the app's base ("/watch/x"), for catalogWait.
const appPath = (pathname: string): string => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return base && pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname
}

/** For the layout route (App.tsx): a page renders once catalogWait lets it; never again after. */
export const catalogRoute = {
  loader: ({ request }: { request: Request }) => {
    const { pathname, search } = new URL(request.url)
    return catalogWait(appPath(pathname), search)?.then(() => null) ?? null
  },
  shouldRevalidate: () => !complete,
}

// After the first screen has painted and its images are in, the rest comes a file at a time (two
// lanes), each fetch at low priority and after the browser had a moment idle, so it never holds up
// an image or a frame. A page that needs it sooner asks for it (catalogWait).
function trickle(): void {
  let next = 0
  const gap = () =>
    new Promise<void>((resolve) =>
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(() => resolve(), { timeout: 150 })
        : setTimeout(resolve, 50),
    )
  const lane = async () => {
    while (next < files.length && !complete) {
      try {
        await loadFile(next++, true)
      } catch {
        return
      }
      await gap()
    }
  }
  void Promise.all([lane(), lane()]).then(() => {
    // Anything that failed is asked for once more.
    if (!complete) void loadAll().catch(() => undefined)
  })
}

// The rest of the catalog starts when the page can spare it: once the first image has painted
// (the hero, the largest paint), when the pictures in view have settled, or at the first touch,
// key press or click, for search suggestions and picks that follow it.
function startTrickle(): void {
  let started = false
  const start = () => {
    if (started) return
    started = true
    trickle()
  }
  whenImagesSettled(start)
  for (const type of ['pointerdown', 'keydown'])
    addEventListener(type, start, { once: true, passive: true, capture: true })
  try {
    const observer = new PerformanceObserver((list) => {
      if (!list.getEntries().some((e) => (e as PerformanceEntry & { url?: string }).url)) return
      observer.disconnect()
      start()
    })
    observer.observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {
    // No such entries (old engines): the settled gate and the first touch stand.
  }
}

registerPersonKeys(summary.people)
const head = expandPart(summary.pack)
if (!files.length) {
  // The dev server and tests: every video is in the summary.
  replaceCatalog(head, catalogNames)
} else {
  summary.at.forEach((at, i) => loaded.set(at, head[i]))
  videos = head
  byId = new Map(head.map((v) => [v.id, v]))
  registerNameTokens(catalogNames)
  partial = summary
  // What the first page needs is asked for now, beside the app's scripts.
  void catalogWait(appPath(location.pathname), location.search)?.catch(() => undefined)
  startTrickle()
}

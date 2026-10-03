// Content-based recommendations: a TF-IDF index over the catalog's text (titles, tags, categories,
// channels, descriptions and, when ingested, transcripts), blended with category, tag and series
// signals and with the user's local profile. Everything runs in the browser; nothing leaves it.
import { GENERAL_CATEGORY, videos } from '../data/catalog'
import { neighborsOf } from '../data/recs'
import type { Video } from '../types'
import type { Profile } from './history'
import { isGenericTag, tagKey, tidyTag } from './tags'
import { normalizeText, STOPWORDS, termWeightsOf, tokenize } from './text'

export interface RecommendOptions {
  /** Personal taste (watch history, searches, My List) reorders near-ties. */
  profile?: Profile
  limit?: number
  /** Video ids never to return. */
  exclude?: Iterable<string>
}

export type ProfileOptions = Omit<RecommendOptions, 'profile'>

// Score blend
const CATEGORY_BOOST = 0.15
const TAG_BOOST = 0.05
const TAG_BOOST_CAP = 0.2
const SERIES_BOOST = 0.1
/** Series up to this size get the full boost; a 60-episode programme is a brand, not a sequence. */
const SERIES_FULL = 10
const PROFILE_WEIGHT = 0.3
const NEIGHBOR_WEIGHT = 0.5
const WATCHED_PENALTY = 0.6
// Profile vector
const HALF_LIFE_MS = 7 * 24 * 3_600_000
const SEARCH_WEIGHT = 0.6
const SAVED_WEIGHT = 0.4
const RECENT_SEARCHES = 10
const RECENT_SAVED = 20
// Diversity
const WATCH_WINDOW = 8
const WATCH_CAP = 4
const PROFILE_CAP = 3
const PROFILE_SERIES_CAP = 2
// Explanations
const MAX_REASON = 60
const MIN_AFFINITY = 0.08

/** Sparse unit vector: term ids ascending with their weights. */
interface Vec {
  ids: Int32Array
  ws: Float32Array
}

interface Index {
  source: readonly Video[]
  docs: Vec[]
  /** video id → position in `source`. */
  pos: Map<string, number>
  terms: Map<string, number>
  idf: Float64Array
  /** Posting lists in CSR form: term t owns postDoc/postW[offsets[t] .. offsets[t + 1]). */
  offsets: Int32Array
  postDoc: Int32Array
  postW: Float32Array
  /** Per document: its series key, when it belongs to one. */
  series: (string | undefined)[]
  seriesSize: Map<string, number>
  /** Per series: tag keys most members carry (the series itself, not a topic). */
  seriesTags: Map<string, Set<string>>
  /** Per document: its informative tag keys (not generic, not catalog-wide). */
  tags: Set<string>[]
  tagDf: Map<string, number>
  tagLimit: number
  stamps: Float64Array
}

const EMPTY_VEC: Vec = { ids: new Int32Array(0), ws: new Float32Array(0) }

/** Unit vector from (term id, weight) pairs; ids stay in insertion order. */
function toVec(entries: ReadonlyMap<number, number>): Vec {
  let norm = 0
  for (const w of entries.values()) if (w > 0) norm += w * w
  if (!norm) return EMPTY_VEC
  norm = Math.sqrt(norm)
  const ids = new Int32Array(entries.size)
  const ws = new Float32Array(entries.size)
  let i = 0
  for (const [id, w] of entries) {
    if (w <= 0) continue
    ids[i] = id
    ws[i++] = w / norm
  }
  return i === entries.size ? { ids, ws } : { ids: ids.slice(0, i), ws: ws.slice(0, i) }
}

/** Projects a bag of terms onto the index vocabulary (unknown and catalog-wide terms drop out). */
function project(idx: Pick<Index, 'terms' | 'idf'>, bag: Map<string, number>): Vec {
  const entries = new Map<number, number>()
  for (const [term, w] of bag) {
    const id = idx.terms.get(term)
    if (id !== undefined && idx.idf[id] > 0) entries.set(id, w * idx.idf[id])
  }
  return toVec(entries)
}

const toLookup = (v: Vec): Map<number, number> => {
  const m = new Map<number, number>()
  for (let i = 0; i < v.ids.length; i++) m.set(v.ids[i], v.ws[i])
  return m
}

const dot = (lookup: ReadonlyMap<number, number>, v: Vec): number => {
  let s = 0
  for (let i = 0; i < v.ids.length; i++) s += (lookup.get(v.ids[i]) ?? 0) * v.ws[i]
  return s
}

const YEAR_RE = /^(?:19|20)\d\d$/
const SEPARATOR_RE = /\s[|:–—-]\s|[|:–—]/u
const NUMBER_RE = /(?<=\s|^)#?(\d+)\b/g
// A key made only of these words (or stopwords) names a format, not a series.
const FORMAT_WORDS = new Set(
  'webinar lecture talk talks introduction intro overview opening closing remarks message welcome documentary interview special'.split(
    ' ',
  ),
)

/**
 * The series a title belongs to: the text before its first separator or episode-like number
 * ("FASTLearn Episode 29 – …" → "fastlearn episode", "Tech Tips 33: …" → "tech tips").
 */
export function seriesKeyOf(title: string): string | undefined {
  const text = normalizeText(title)
  let cut = text.length
  const sep = text.search(SEPARATOR_RE)
  if (sep >= 0) cut = sep
  for (const m of text.matchAll(NUMBER_RE)) {
    if (YEAR_RE.test(m[1])) continue
    cut = Math.min(cut, m.index)
    break
  }
  if (cut === text.length) return undefined
  const key = text
    .slice(0, cut)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  const words = key.split(' ')
  if (key.length < 4 || words.every((w) => STOPWORDS.has(w) || FORMAT_WORDS.has(w)))
    return undefined
  return key
}

const stampOf = (at: unknown): number => (typeof at === 'number' && Number.isFinite(at) ? at : 0)

function build(list: readonly Video[]): Index {
  const n = list.length
  const bags = list.map((v) => termWeightsOf(v))
  const df = new Map<string, number>()
  for (const bag of bags) for (const t of bag.keys()) df.set(t, (df.get(t) ?? 0) + 1)

  // Terms in over a quarter of a large catalog ("elearning", "university") carry no signal.
  const common = Math.max(n / 4, 20)
  const terms = new Map<string, number>()
  const idf = new Float64Array(df.size)
  for (const [t, count] of df) {
    idf[terms.size] = count > common ? 0 : Math.log(n / count)
    terms.set(t, terms.size)
  }

  const docs = bags.map((bag) => project({ terms, idf }, bag))
  const offsets = new Int32Array(terms.size + 1)
  for (const vec of docs) for (const id of vec.ids) offsets[id + 1]++
  for (let t = 0; t < terms.size; t++) offsets[t + 1] += offsets[t]
  const cursor = offsets.slice(0, -1)
  const postDoc = new Int32Array(offsets[terms.size])
  const postW = new Float32Array(offsets[terms.size])
  docs.forEach((vec, d) => {
    for (let i = 0; i < vec.ids.length; i++) {
      const k = cursor[vec.ids[i]]++
      postDoc[k] = d
      postW[k] = vec.ws[i]
    }
  })

  // Tags repeat across the catalog: normalize each spelling once (null marks a generic tag).
  const keyMemo = new Map<string, string | null>()
  const keyOf = (tag: string) => {
    let k = keyMemo.get(tag)
    if (k === undefined) keyMemo.set(tag, (k = isGenericTag(tag) ? null : tagKey(tag)))
    return k
  }
  const tagDf = new Map<string, number>()
  const keysOf = list.map((v) => [...new Set(v.tags.map(keyOf))].filter((k) => k !== null))
  for (const keys of keysOf) for (const k of keys) tagDf.set(k, (tagDf.get(k) ?? 0) + 1)
  const tagLimit = Math.max(n / 10, 20)
  const tags = keysOf.map((keys) => new Set(keys.filter((k) => (tagDf.get(k) ?? 0) <= tagLimit)))

  const seriesSize = new Map<string, number>()
  const keys = list.map((v) => seriesKeyOf(v.title))
  for (const k of keys) if (k) seriesSize.set(k, (seriesSize.get(k) ?? 0) + 1)
  const maxSeries = Math.max(n * 0.05, 10)
  const series = keys.map((k) => {
    const size = k ? (seriesSize.get(k) ?? 0) : 0
    return size >= 2 && size <= maxSeries ? k : undefined
  })
  const members = new Map<string, number[]>()
  series.forEach((k, d) => {
    if (!k) return
    const ds = members.get(k)
    if (ds) ds.push(d)
    else members.set(k, [d])
  })
  const seriesTags = new Map<string, Set<string>>()
  for (const [k, ds] of members) {
    if (ds.length < 3) continue
    const counts = new Map<string, number>()
    for (const d of ds) for (const t of keysOf[d]) counts.set(t, (counts.get(t) ?? 0) + 1)
    seriesTags.set(k, new Set([...counts].filter(([, c]) => c * 2 >= ds.length).map(([t]) => t)))
  }

  return {
    source: list,
    docs,
    pos: new Map(list.map((v, i) => [v.id, i])),
    terms,
    idf,
    offsets,
    postDoc,
    postW,
    series,
    seriesSize,
    seriesTags,
    tags,
    tagDf,
    tagLimit,
    stamps: Float64Array.from(list, (v) => Date.parse(v.publishedAt) || 0),
  }
}

let index: Index | undefined

// `videos` is a live binding that setCatalog() replaces, so identity tells us when to rebuild.
function getIndex(): Index {
  if (!index || index.source !== videos) index = build(videos)
  return index
}

/** Builds the index ahead of the first recommendation (e.g. from an idle callback). */
export const warmRecommender = (): void => {
  getIndex()
}

// Videos outside the catalog (fixtures, stale links) are vectorized on the fly.
const vectorOf = (idx: Index, v: Video): Vec => {
  const p = idx.pos.get(v.id)
  return p === undefined ? project(idx, termWeightsOf(v)) : idx.docs[p]
}

const seriesOf = (idx: Index, v: Video): string | undefined => {
  const p = idx.pos.get(v.id)
  if (p !== undefined) return idx.series[p]
  const key = seriesKeyOf(v.title)
  return key && idx.seriesSize.has(key) ? key : undefined
}

const tagKeysOf = (idx: Index, v: Video): Set<string> => {
  const p = idx.pos.get(v.id)
  if (p !== undefined) return idx.tags[p]
  const keys = v.tags.filter((t) => !isGenericTag(t)).map(tagKey)
  return new Set(keys.filter((k) => (idx.tagDf.get(k) ?? 0) <= idx.tagLimit))
}

/** Cosine of `q` against every document, via the posting lists of the query's terms. */
function scoreAll(idx: Index, q: Vec): Float64Array {
  const out = new Float64Array(idx.docs.length)
  for (let i = 0; i < q.ids.length; i++) {
    const t = q.ids[i]
    const w = q.ws[i]
    for (let k = idx.offsets[t]; k < idx.offsets[t + 1]; k++)
      out[idx.postDoc[k]] += w * idx.postW[k]
  }
  return out
}

function queryVector(idx: Index, query: string): Vec {
  const bag = new Map<string, number>()
  for (const t of tokenize(query, { bigrams: true })) {
    bag.set(t, (bag.get(t) ?? 0) + (t.includes(' ') ? 0.5 : 1))
  }
  return project(idx, bag)
}

/** Recency-weighted sum of what the user watched, searched for and saved; undefined when empty. */
function profileVector(idx: Index, profile: Profile): Vec | undefined {
  const acc = new Map<number, number>()
  const add = (vec: Vec, weight: number) => {
    if (weight <= 0) return
    for (let i = 0; i < vec.ids.length; i++) {
      acc.set(vec.ids[i], (acc.get(vec.ids[i]) ?? 0) + weight * vec.ws[i])
    }
  }
  const watched = profile.watched.filter((e) => idx.pos.has(e.id))
  const latest = watched.reduce((t, e) => Math.max(t, stampOf(e.at)), 0)
  for (const e of watched) {
    const age = latest - stampOf(e.at)
    add(idx.docs[idx.pos.get(e.id) as number], 0.5 ** (age / HALF_LIFE_MS))
  }
  for (const s of profile.searches.slice(0, RECENT_SEARCHES)) {
    add(queryVector(idx, s.q), SEARCH_WEIGHT)
  }
  for (const id of profile.saved.slice(0, RECENT_SAVED)) {
    const p = idx.pos.get(id)
    if (p !== undefined) add(idx.docs[p], SAVED_WEIGHT)
  }
  return acc.size ? toVec(acc) : undefined
}

const hasSignal = (p?: Profile): p is Profile =>
  !!p && (p.watched.length > 0 || p.searches.length > 0 || p.saved.length > 0)

interface Diversity {
  /** Most documents per category inside the window. */
  cap: number
  /** How many leading slots the caps apply to. */
  window: number
  /** A category that is never capped (the query video's own). */
  free?: string
  /** Most documents per series inside the window. */
  seriesCap?: number
}

/**
 * Picks up to `limit` documents in rank order, skipping candidates that would exceed a cap inside
 * the window. Skipped candidates come straight after the window: they outrank what follows.
 */
function pickDiverse(
  idx: Index,
  ranked: number[],
  limit: number,
  { cap, window, free, seriesCap = Infinity }: Diversity,
): number[] {
  const out: number[] = []
  const deferred: number[] = []
  const used = new Map<string, number>()
  const count = (key: string) => used.get(key) ?? 0
  let i = 0
  for (; i < ranked.length && out.length < window; i++) {
    const d = ranked[i]
    const category = `c:${idx.source[d].category}`
    const series = idx.series[d] && `s:${idx.series[d]}`
    if (
      (idx.source[d].category !== free && count(category) >= cap) ||
      (series && count(series) >= seriesCap)
    ) {
      deferred.push(d)
      continue
    }
    out.push(d)
    used.set(category, count(category) + 1)
    if (series) used.set(series, count(series) + 1)
  }
  return [...out, ...deferred, ...ranked.slice(i)].slice(0, limit)
}

const rank = (idx: Index, scores: Float64Array, candidates: number[]): number[] =>
  candidates.sort((a, b) => scores[b] - scores[a] || idx.stamps[b] - idx.stamps[a])

/** Videos like `video`, best first: text similarity plus category, tag and series signals. */
export function recommendFor(
  video: Video,
  { profile, limit = 12, exclude }: RecommendOptions = {},
): Video[] {
  const idx = getIndex()
  const n = idx.docs.length
  const content = scoreAll(idx, vectorOf(idx, video))
  const taste = hasSignal(profile) ? profileVector(idx, profile) : undefined
  const affinity = taste ? scoreAll(idx, taste) : undefined
  const watched = new Set(profile?.watched.map((e) => e.id))
  const skip = new Set(exclude)
  skip.add(video.id)
  const self = idx.pos.get(video.id)
  const ownTags = tagKeysOf(idx, video)
  const series = seriesOf(idx, video)
  const seriesBoost = series
    ? SERIES_BOOST * Math.min(1, SERIES_FULL / (idx.seriesSize.get(series) ?? 1))
    : 0
  const seriesTags = series ? idx.seriesTags.get(series) : undefined
  const sameCategory = video.category !== GENERAL_CATEGORY
  const extra = new Map<number, number>()
  for (const [i, score] of neighborsOf(video.youtubeId)) {
    if (i >= 0 && i < n && i !== self) extra.set(i, Math.max(extra.get(i) ?? 0, score))
  }

  const scores = new Float64Array(n)
  const candidates: number[] = []
  for (let d = 0; d < n; d++) {
    const v = idx.source[d]
    if (d === self || skip.has(v.id)) continue
    let score = content[d] + NEIGHBOR_WEIGHT * (extra.get(d) ?? 0)
    if (sameCategory && v.category === video.category) score += CATEGORY_BOOST
    const sameSeries = series !== undefined && idx.series[d] === series
    if (sameSeries) score += seriesBoost
    // Tags the whole series carries are already paid for by the series boost.
    let shared = 0
    for (const k of idx.tags[d]) if (ownTags.has(k) && !(sameSeries && seriesTags?.has(k))) shared++
    score += Math.min(TAG_BOOST_CAP, shared * TAG_BOOST)
    if (score <= 0) continue
    if (affinity) score += PROFILE_WEIGHT * affinity[d]
    if (watched.has(v.id)) score *= WATCHED_PENALTY
    scores[d] = score
    candidates.push(d)
  }
  const ranked = rank(idx, scores, candidates)
  const picked = pickDiverse(idx, ranked, limit, {
    cap: WATCH_CAP,
    window: WATCH_WINDOW,
    free: video.category,
  })
  return picked.map((d) => idx.source[d])
}

/** Videos for the user's taste (unwatched), best first; `[]` when the profile is empty. */
export function recommendForProfile(
  profile: Profile,
  { limit = 12, exclude }: ProfileOptions = {},
): Video[] {
  const idx = getIndex()
  const taste = hasSignal(profile) ? profileVector(idx, profile) : undefined
  if (!taste) return []
  const scores = scoreAll(idx, taste)
  const skip = new Set(exclude)
  for (const e of profile.watched) skip.add(e.id)
  const candidates: number[] = []
  for (let d = 0; d < idx.docs.length; d++) {
    if (scores[d] > 0 && !skip.has(idx.source[d].id)) candidates.push(d)
  }
  const ranked = rank(idx, scores, candidates)
  const picked = pickDiverse(idx, ranked, limit, {
    cap: PROFILE_CAP,
    window: limit,
    seriesCap: PROFILE_SERIES_CAP,
  })
  return picked.map((d) => idx.source[d])
}

const fit = (s: string): string =>
  s.length <= MAX_REASON ? s : `${s.slice(0, MAX_REASON - 1).trimEnd()}…`

const quoted = (prefix: string, text: string): string => {
  const room = MAX_REASON - prefix.length - 3
  const t = text.length > room ? `${text.slice(0, room - 1).trimEnd()}…` : text
  return `${prefix} “${t}”`
}

const joinWithin = (prefix: string, names: string[]): string => {
  let line = `${prefix}${names[0]}`
  for (const name of names.slice(1, 3)) {
    const next = `${line}, ${name}`
    if (next.length > MAX_REASON) break
    line = next
  }
  return fit(line)
}

/** Informative tags both videos carry (minus their series' own), rarest first, as the candidate spells them. */
function sharedTopics(idx: Index, video: Video, candidate: Video, sameSeries: boolean): string[] {
  const own = tagKeysOf(idx, video)
  const theirs = tagKeysOf(idx, candidate)
  const seriesTags = sameSeries ? idx.seriesTags.get(seriesOf(idx, video) ?? '') : undefined
  const seen = new Set<string>()
  const names: string[] = []
  const sorted = [...candidate.tags].sort(
    (a, b) => (idx.tagDf.get(tagKey(a)) ?? 0) - (idx.tagDf.get(tagKey(b)) ?? 0),
  )
  for (const tag of sorted) {
    const k = tagKey(tag)
    if (own.has(k) && theirs.has(k) && !seen.has(k) && !seriesTags?.has(k)) {
      seen.add(k)
      names.push(tidyTag(tag))
    }
  }
  return names
}

const informative = (idx: Index, term: string): boolean => {
  const id = idx.terms.get(term)
  return id !== undefined && idx.idf[id] > 0
}

/** Title words (as the candidate spells them) whose stems also occur in the video's title. */
function sharedTitleWords(idx: Index, video: Video, candidate: Video): string[] {
  const own = new Set(tokenize(video.title).filter((t) => informative(idx, t)))
  const seen = new Set<string>()
  const words: string[] = []
  for (const word of candidate.title.split(/[^\p{L}\p{N}]+/u)) {
    const [term] = tokenize(word)
    if (term && own.has(term) && !seen.has(term)) {
      seen.add(term)
      words.push(word)
    }
  }
  return words
}

/** The video among `ids` most similar to `candidate`, when similar enough; ties keep list order. */
function closest(idx: Index, candidate: Video, ids: readonly string[]): Video | undefined {
  const lookup = toLookup(vectorOf(idx, candidate))
  let best: Video | undefined
  let bestScore = MIN_AFFINITY
  for (const id of ids) {
    const p = idx.pos.get(id)
    if (p === undefined || id === candidate.id) continue
    const s = dot(lookup, idx.docs[p])
    if (s > bestScore) {
      best = idx.source[p]
      bestScore = s
    }
  }
  return best
}

function matchesQuery(idx: Index, candidate: Video, query: string): boolean {
  const ids = new Set(vectorOf(idx, candidate).ids)
  const wanted = tokenize(query).map((t) => idx.terms.get(t))
  return wanted.length > 0 && wanted.every((id) => id !== undefined && ids.has(id))
}

/**
 * A short reason (≤ 60 characters) for showing `candidate`: relative to the video being watched
 * when `video` is given, otherwise (or failing that) relative to the profile.
 */
export function explain(
  video: Video | null | undefined,
  candidate: Video,
  profile?: Profile,
): string {
  const idx = getIndex()
  if (video) {
    const series = seriesOf(idx, video)
    const sameSeries = series !== undefined && seriesOf(idx, candidate) === series
    const topics = sharedTopics(idx, video, candidate, sameSeries)
    // In a short series the sequence is the point; in a long programme the topic says more.
    if (sameSeries && ((idx.seriesSize.get(series) ?? 0) <= SERIES_FULL || !topics.length)) {
      return 'Same series'
    }
    if (topics.length) return joinWithin('Shares topics: ', topics)
    const words = sharedTitleWords(idx, video, candidate)
    if (words.length) return joinWithin('Also about ', words)
  }
  if (profile) {
    const watched = closest(
      idx,
      candidate,
      profile.watched.map((e) => e.id),
    )
    if (watched) return quoted('Because you watched', watched.title)
    const search = profile.searches
      .slice(0, RECENT_SEARCHES)
      .find((s) => matchesQuery(idx, candidate, s.q))
    if (search) return quoted('Matches your search', search.q)
    const saved = closest(idx, candidate, profile.saved)
    if (saved) return quoted('Because you saved', saved.title)
  }
  if (
    candidate.category !== GENERAL_CATEGORY &&
    (!video || video.category === candidate.category)
  ) {
    return fit(`More from ${candidate.category}`)
  }
  return video ? 'Related video' : 'Recommended for you'
}

// Content-based recommendations: a TF-IDF index over the catalog's text (titles, tags, categories,
// channels, descriptions and, when ingested, transcripts), blended with category, tag and series
// signals and with the user's local profile. Everything runs in the browser; nothing leaves it.
import { GENERAL_CATEGORY, videos } from '../data/catalog'
import { neighborsOf } from '../data/recs'
import type { Video } from '../types'
import type { Profile } from './history'
import {
  isAcronymOf,
  isGenericTag,
  isNameToken,
  isOrgTag,
  isPersonTag,
  POPULAR_SERIES,
  tagKey,
  tidyTag,
} from './tags'
import { normalizeText, stem, STOPWORDS, termWeightsOf, tokenize } from './text'

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
/** In every 8 profile picks, these positions go to the latest search's best matches. */
const SEARCH_SLOTS = [1, 4]
const SLOT_BLOCK = 8
/** Titles sharing this share of their terms (Jaccard) are one talk. */
const SAME_TALK = 0.8
// Explanations
const MAX_REASON = 40
/** Uses of one reason in any SAME_WINDOW rows of a list before another (or a rewording) is used. */
const MAX_SAME = 3
const SAME_WINDOW = 8
const MIN_QUOTE = 16
const MIN_AFFINITY = 0.08
/** "Also about …" needs two shared title terms, one of them in at most 3% of the catalog. */
const MIN_TITLE_TERMS = 2
const RARE_SHARE = 0.03

/** Sparse unit vector: term ids (in insertion order) with their weights. */
interface Vec {
  ids: Int32Array
  ws: Float32Array
}

/** What near-duplicate checks compare for one title. */
interface Talk {
  key: string
  terms: Set<string>
  /** Episode, part and year numbers: they keep instalments apart. */
  marks: string
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
  /** Tag keys that name a programme ("Akdang Buhay", "Infoteach"): a series, not a topic. */
  programmes: Set<string>
  /** Per document: its informative tag keys (not generic, not catalog-wide). */
  tags: Set<string>[]
  tagDf: Map<string, number>
  tagLimit: number
  stamps: Float64Array
  /** Per document: its title key (see titleKey). */
  keys: string[]
  /** Title keys several documents share → those documents, newest first. */
  groups: Map<string, number[]>
  /** Per document, filled on demand. */
  talks: (Talk | undefined)[]
  /** Title terms at least this informative are rare enough to explain a pick. */
  rareIdf: number
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

/** Shorter than this, a title's body ("Akdang Buhay") needs its speaker to name the talk. */
const MIN_BODY = 20
// A suffix like these makes a title its own instalment rather than another cut of the same talk.
const INSTALMENT =
  /\b(episode|ep|part|session|module|chapter|lesson|lecture|day|week|vol|volume)\b|\d/i
const NON_ASCII = /[^\x20-\x7e]/
const NON_WORD = /[^a-z0-9]+/g
const NON_WORD_U = /[^\p{L}\p{N}]+/gu

/** Lowercase words only: "Women’s Day: A Talk" → "womens day a talk". */
const plainOf = (s: string): string => {
  const text = normalizeText(s)
  return text.replace(NON_ASCII.test(text) ? NON_WORD_U : NON_WORD, ' ').trim()
}

/**
 * Groups speaker cuts and re-uploads of one talk ("… | Dr. X", "… | Ms. Y, RN") under one key, so
 * a list shows one of them; episodes and parts ("… | Episode 5 (Part 3)") stay distinct.
 */
export function titleKey(title: string): string {
  const cut = title.lastIndexOf(' | ')
  return plainOf(
    cut >= MIN_BODY && !INSTALMENT.test(title.slice(cut + 3)) ? title.slice(0, cut) : title,
  )
}

const TAIL = / [|–—-] /g
const EDGE = /^[^\p{L}\p{N}&]+|[^\p{L}\p{N}]+$/gu

const NAME_WORD = /^["“”‘’']?\p{Lu}[\p{L}'’.-]*["“”‘’']?$/u
const PARTICLES = new Set(['de', 'dela', 'del', 'la', 'los', 'las', 'van', 'von', 'da', 'di', 'y'])

/** A speaker: a person tag, or two to four capitalised words with a known name among them. */
function isSpeaker(text: string): boolean {
  if (isPersonTag(text)) return true
  const words = text.split(/\s+/)
  return (
    words.length >= 2 &&
    words.length <= 4 &&
    words.every((w) => NAME_WORD.test(w) || PARTICLES.has(w)) &&
    words.some((w) => isNameToken(w.replace(/[^\p{L}'’-]/gu, '')))
  )
}

/** A title's speaker credit ("… | Dr. X, RN – Affiliation"): where it starts and the name. */
function creditOf(title: string): { at: number; name: string } | undefined {
  const seps = Array.from(title.matchAll(TAIL), (m) => m.index)
  for (let i = 0; i < seps.length; i++) {
    const name = title
      .slice(seps[i] + 3, seps[i + 1])
      .split(',')[0]
      .trim()
    if (isSpeaker(name)) return { at: seps[i], name }
  }
  return undefined
}

/** Where the speaker credit starts, else the title's length. */
const bodyEnd = (title: string): number => creditOf(title)?.at ?? title.length

/** A term that is someone's name; "Santos" stems to "santo". */
const isName = (term: string) => isNameToken(term) || isNameToken(`${term}s`)

const MARKS =
  /\b(?:part|pt|episode|ep|session|module|chapter|lesson|lecture|vol|volume|book|day|week|level|unit|no)\.?\s*([ivx]+|\d+)\b|\d+/g

function talkOf(title: string, key = titleKey(title)): Talk {
  const end = bodyEnd(title)
  // Faculty prefixes ("FMDS …") do not make another talk.
  const words = (end >= MIN_BODY ? title.slice(0, end) : title)
    .split(/\s+/)
    .filter((w) => !isOrgTag(w.replace(EDGE, '')))
  const marks = Array.from(normalizeText(title).matchAll(MARKS), (m) => m[1] ?? m[0]).join(' ')
  return { key, terms: new Set(tokenize(words.join(' '))), marks }
}

function sameTalk(a: Talk, b: Talk): boolean {
  if (a.key === b.key) return true
  if (a.marks !== b.marks || !a.terms.size || !b.terms.size) return false
  let both = 0
  for (const t of a.terms) if (b.terms.has(t)) both++
  return both >= SAME_TALK * (a.terms.size + b.terms.size - both)
}

/** Whether two videos are one talk: speaker cuts, re-uploads or near-identical titles. */
export const isNearDuplicate = (a: Video, b: Video): boolean =>
  sameTalk(talkOf(a.title), talkOf(b.title))

const stampOf = (at: unknown): number => (typeof at === 'number' && Number.isFinite(at) ? at : 0)

/** Work per step of a sliced build, in ms: short enough to keep the page responsive on slow phones. */
const STEP_MS = 8
/** How often (in documents) a build step checks the clock. */
const CHECK_EVERY = 16

const countInto = (counts: Map<string, number>, keys: Iterable<string>) => {
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1)
}

/** What the first pass learns about each document. */
interface Scan {
  bags: Map<string, number>[]
  df: Map<string, number>
  keysOf: string[][]
  seriesKeys: (string | undefined)[]
  titleKeys: string[]
  stamps: Float64Array
}

function newScan(n: number): Scan {
  return {
    bags: [],
    df: new Map(),
    keysOf: [],
    seriesKeys: [],
    titleKeys: [],
    stamps: new Float64Array(n),
  }
}

function scanOne(scan: Scan, v: Video, d: number, keyOf: (tag: string) => string | null) {
  const bag = termWeightsOf(v)
  scan.bags.push(bag)
  countInto(scan.df, bag.keys())
  scan.keysOf.push([...new Set(v.tags.map(keyOf))].filter((k) => k !== null))
  scan.seriesKeys.push(seriesKeyOf(v.title))
  scan.titleKeys.push(titleKey(v.title))
  scan.stamps[d] = Date.parse(v.publishedAt) || 0
}

function vocabulary(df: Map<string, number>, n: number): Pick<Index, 'terms' | 'idf'> {
  // Terms in over a quarter of a large catalog ("elearning", "university") carry no signal.
  const common = Math.max(n / 4, 20)
  const terms = new Map<string, number>()
  const idf = new Float64Array(df.size)
  for (const [t, count] of df) {
    idf[terms.size] = count > common ? 0 : Math.log(n / count)
    terms.set(t, terms.size)
  }
  return { terms, idf }
}

function postings(docs: Vec[], termCount: number): Pick<Index, 'offsets' | 'postDoc' | 'postW'> {
  const offsets = new Int32Array(termCount + 1)
  for (const vec of docs) for (const id of vec.ids) offsets[id + 1]++
  for (let t = 0; t < termCount; t++) offsets[t + 1] += offsets[t]
  const cursor = offsets.slice(0, -1)
  const postDoc = new Int32Array(offsets[termCount])
  const postW = new Float32Array(offsets[termCount])
  docs.forEach((vec, d) => {
    for (let i = 0; i < vec.ids.length; i++) {
      const k = cursor[vec.ids[i]]++
      postDoc[k] = d
      postW[k] = vec.ws[i]
    }
  })
  return { offsets, postDoc, postW }
}

type Grouping = Pick<
  Index,
  'series' | 'seriesSize' | 'seriesTags' | 'programmes' | 'tags' | 'tagDf' | 'tagLimit' | 'groups'
>

/** Tags, series and title groups, from the first pass. */
function grouping({ keysOf, seriesKeys, titleKeys, stamps }: Scan, n: number): Grouping {
  const tagDf = new Map<string, number>()
  for (const keys of keysOf) countInto(tagDf, keys)
  const tagLimit = Math.max(n / 10, 20)
  const tags = keysOf.map((keys) => new Set(keys.filter((k) => (tagDf.get(k) ?? 0) <= tagLimit)))

  const seriesSize = new Map<string, number>()
  for (const k of seriesKeys) if (k) seriesSize.set(k, (seriesSize.get(k) ?? 0) + 1)
  const maxSeries = Math.max(n * 0.05, 10)
  const series = seriesKeys.map((k) => {
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
    for (const d of ds) countInto(counts, keysOf[d])
    seriesTags.set(k, new Set([...counts].filter(([, c]) => c * 2 >= ds.length).map(([t]) => t)))
  }
  // A tag that starts like the series' name and that few videos outside it carry is the programme.
  const programmes = new Set(POPULAR_SERIES.map(tagKey))
  for (const [k, ts] of seriesTags) {
    const name = k.replace(/ /g, '')
    const size = seriesSize.get(k) ?? 0
    for (const t of ts) {
      const own = (tagDf.get(t) ?? 0) <= 2 * size
      if (own && t.length >= 4 && (name.startsWith(t) || t.startsWith(name))) programmes.add(t)
    }
  }

  const byKey = new Map<string, number[]>()
  titleKeys.forEach((k, d) => {
    const ds = byKey.get(k)
    if (ds) ds.push(d)
    else byKey.set(k, [d])
  })
  const groups = new Map<string, number[]>()
  for (const [k, ds] of byKey) {
    if (ds.length > 1)
      groups.set(
        k,
        ds.sort((a, b) => stamps[b] - stamps[a]),
      )
  }
  return { series, seriesSize, seriesTags, programmes, tags, tagDf, tagLimit, groups }
}

/** The index build as steps of about STEP_MS each (see warmRecommenderAsync). */
function* building(list: readonly Video[]): Generator<void, Index, void> {
  const n = list.length
  let started = performance.now()
  const due = (d: number) => {
    if (d % CHECK_EVERY !== CHECK_EVERY - 1 || performance.now() - started < STEP_MS) return false
    started = performance.now()
    return true
  }
  // Tags repeat across the catalog: normalize each spelling once (null marks a generic tag).
  const keyMemo = new Map<string, string | null>()
  const keyOf = (tag: string) => {
    let k = keyMemo.get(tag)
    if (k === undefined) keyMemo.set(tag, (k = isGenericTag(tag) ? null : tagKey(tag)))
    return k
  }
  const scan = newScan(n)
  for (let d = 0; d < n; d++) {
    scanOne(scan, list[d], d, keyOf)
    if (due(d)) yield
  }
  const vocab = vocabulary(scan.df, n)
  yield
  const docs: Vec[] = []
  for (let d = 0; d < n; d++) {
    docs.push(project(vocab, scan.bags[d]))
    if (due(d)) yield
  }
  const posted = postings(docs, vocab.terms.size)
  yield
  return {
    source: list,
    docs,
    pos: new Map(list.map((v, i) => [v.id, i])),
    ...vocab,
    ...posted,
    ...grouping(scan, n),
    stamps: scan.stamps,
    keys: scan.titleKeys,
    talks: [],
    rareIdf: Math.log(n / Math.max(2, n * RARE_SHARE)),
  }
}

let index: Index | undefined

interface Job {
  list: readonly Video[]
  steps: Generator<void, Index, void>
  /** Set while warmRecommenderAsync drives the steps. */
  done?: Promise<void>
}

/** The build under way, shared by the sliced and the synchronous paths. */
let job: Job | undefined

const jobFor = (list: readonly Video[]): Job =>
  job?.list === list ? job : (job = { list, steps: building(list) })

// `videos` is a live binding that setCatalog() replaces, so identity tells us when to rebuild.
function getIndex(): Index {
  if (index?.source === videos) return index
  // Finishes a sliced build in progress rather than starting over.
  const { steps } = jobFor(videos)
  let step = steps.next()
  while (!step.done) step = steps.next()
  job = undefined
  return (index = step.value)
}

/** Builds the index ahead of the first recommendation, in one go. */
export const warmRecommender = (): void => {
  getIndex()
}

/** Whether the index is built, so a recommendation now takes about a millisecond. */
export const isRecommenderReady = (): boolean => index?.source === videos

interface Scheduler {
  yield?: () => Promise<void>
}

/** Lets the browser paint and handle input: scheduler.yield() where supported. */
function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: Scheduler }).scheduler
  if (scheduler?.yield) return scheduler.yield()
  return new Promise((resolve) => {
    if (typeof MessageChannel === 'undefined') {
      setTimeout(resolve, 0)
      return
    }
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      resolve()
    }
    channel.port2.postMessage(null)
  })
}

async function runSlices(current: Job): Promise<void> {
  for (;;) {
    await yieldToMain()
    // Done meanwhile by a synchronous call, or the catalog changed.
    if (index?.source === current.list || job !== current) return
    const step = current.steps.next()
    if (step.done) {
      index = step.value
      job = undefined
      return
    }
  }
}

/**
 * Builds the index in steps of about 8 ms, yielding to the browser between them, so no task runs
 * long. Calls share one build; a recommendation asked for meanwhile finishes it at once.
 */
export function warmRecommenderAsync(): Promise<void> {
  if (index?.source === videos) return Promise.resolve()
  const current = jobFor(videos)
  return (current.done ??= runSlices(current))
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

const talkAt = (idx: Index, d: number): Talk =>
  (idx.talks[d] ??= talkOf(idx.source[d].title, idx.keys[d]))

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

/** The informative terms a query needs; none when one of its words is unknown to the catalog. */
function queryTerms(idx: Index, query: string): number[] {
  const ids: number[] = []
  for (const t of tokenize(query)) {
    const id = idx.terms.get(t)
    if (id === undefined) return []
    if (idx.idf[id] > 0 && !ids.includes(id)) ids.push(id)
  }
  return ids
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

/**
 * The ranking with one entry per talk, up to `max`. A title group (speaker cuts, re-uploads)
 * shows its newest eligible member at the rank of its best one, as do near-identical titles; a
 * re-upload of `video` itself is dropped.
 */
function uniqueTalks(
  idx: Index,
  ranked: number[],
  eligible: (d: number) => boolean,
  max: number,
  video?: Video,
): number[] {
  const out: number[] = []
  const taken = new Set<number>()
  const ownKey = video && titleKey(video.title)
  const ownTitle = video && plainOf(video.title)
  for (const r of ranked) {
    if (out.length >= max) break
    const group = idx.groups.get(idx.keys[r])
    const d = group?.find((m) => m === r || (!taken.has(m) && eligible(m))) ?? r
    if (taken.has(d)) continue
    if (idx.keys[d] === ownKey && plainOf(idx.source[d].title) === ownTitle) continue
    const talk = talkAt(idx, d)
    const twin = out.findIndex((p) => sameTalk(talkAt(idx, p), talk))
    taken.add(d)
    // Of near-identical titles, the newer upload stands in.
    if (twin < 0) out.push(d)
    else if (idx.stamps[d] > idx.stamps[out[twin]]) out[twin] = d
  }
  return out
}

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
    // A watched video resembles the taste it shaped: no boost, and a penalty.
    if (watched.has(v.id)) score *= WATCHED_PENALTY
    else if (affinity) score += PROFILE_WEIGHT * affinity[d]
    scores[d] = score
    candidates.push(d)
  }
  // A newer cut of the same talk may stand in, unless the user has watched it.
  const eligible = (d: number) => scores[d] > 0 && !watched.has(idx.source[d].id)
  const ranked = uniqueTalks(idx, rank(idx, scores, candidates), eligible, limit * 3, video)
  const picked = pickDiverse(idx, ranked, limit, {
    cap: WATCH_CAP,
    window: WATCH_WINDOW,
    free: video.category,
  })
  // A pick that could only be called "Related video" gives way to a later one with a real reason.
  // The same collection is always a reason ("More from …"), so only the others are explained.
  let ctx: Context | undefined
  const plain = (d: number) => {
    const v = idx.source[d]
    if (sameCategory && v.category === video.category) return false
    ctx ??= contextOf(idx, video, profile)
    return reasonsFor(ctx, v).length === 1
  }
  let spare: number[] | undefined
  return picked.map((d) => {
    if (!plain(d)) return idx.source[d]
    spare ??= ranked.filter((r) => !picked.includes(r) && !plain(r))
    return idx.source[spare.shift() ?? d]
  })
}

/** The documents matching every informative term of `query`, best first, one per talk. */
function searchMatches(
  idx: Index,
  query: string,
  open: (d: number) => boolean,
  max: number,
): number[] {
  const ids = queryTerms(idx, query)
  if (!ids.length) return []
  const hits = new Uint8Array(idx.docs.length)
  for (const t of ids)
    for (let k = idx.offsets[t]; k < idx.offsets[t + 1]; k++) hits[idx.postDoc[k]]++
  const matching = (d: number) => hits[d] === ids.length && open(d)
  const found: number[] = []
  for (let d = 0; d < hits.length; d++) if (matching(d)) found.push(d)
  const scores = scoreAll(idx, queryVector(idx, query))
  return uniqueTalks(idx, rank(idx, scores, found), matching, max)
}

function withinCaps(idx: Index, list: readonly number[], d: number): boolean {
  const { category } = idx.source[d]
  const series = idx.series[d]
  let inCategory = 0
  let inSeries = 0
  for (const p of list) {
    if (idx.source[p].category === category) inCategory++
    if (series && idx.series[p] === series) inSeries++
  }
  return inCategory < PROFILE_CAP && inSeries < PROFILE_SERIES_CAP
}

/** Puts the latest search's best matches in their reserved positions, within the caps. */
function withSearchSlots(idx: Index, picked: number[], matches: number[], limit: number): number[] {
  let out = picked.slice(0, limit)
  const slots: number[] = []
  for (let p = 0; p < limit; p++) if (SEARCH_SLOTS.includes(p % SLOT_BLOCK)) slots.push(p)
  let wanted = slots.length
  let filled = 0
  for (const d of matches) {
    if (!wanted) break
    if (out.includes(d)) {
      wanted--
      continue
    }
    // What stays once `d` is in: the last pick makes room when the list is full.
    const kept = out.length < limit ? out.slice() : out.slice(0, -1)
    const talk = talkAt(idx, d)
    if (kept.some((p) => sameTalk(talkAt(idx, p), talk)) || !withinCaps(idx, kept, d)) continue
    kept.splice(Math.min(slots[filled++], kept.length), 0, d)
    out = kept
    wanted--
  }
  return out
}

/**
 * Videos for the user's taste (unwatched), best first; `[]` when the profile is empty. Up to 2 of
 * every 8 places go to the best matches for the latest search.
 */
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
  const open = (d: number) => !skip.has(idx.source[d].id)
  const candidates: number[] = []
  for (let d = 0; d < idx.docs.length; d++) if (scores[d] > 0 && open(d)) candidates.push(d)
  const eligible = (d: number) => scores[d] > 0 && open(d)
  const ranked = uniqueTalks(idx, rank(idx, scores, candidates), eligible, limit * 3)
  const picked = pickDiverse(idx, ranked, limit, {
    cap: PROFILE_CAP,
    window: limit,
    seriesCap: PROFILE_SERIES_CAP,
  })
  const latest = profile.searches[0]?.q
  const matches = latest ? searchMatches(idx, latest, open, limit) : []
  return withSearchSlots(idx, picked, matches, limit).map((d) => idx.source[d])
}

// Explanations

// Words naming a format, an event or a broad idea rather than a topic: never a reason by themselves.
const GENERIC_TERMS: ReadonlySet<string> = new Set(
  `value digital keynote speech opening closing remark ceremony session part episode webinar
lecture forum program programme introduction intro overview basic tip series conference talk chat
day message welcome panel discussion presentation orientation launch event week year annual
national international new special plenary concurrent address highlight recap module lesson course
class seminar workshop training meeting summit symposium congress colloquium convention festival
celebration anniversary story experience perspective insight reflection conversation interview
documentary feature update report review guide primer fundamental essential challenge opportunity
issue trend future role impact toward beyond initiative prepare preparing masterclass microvideo
briefing phase first second third fourth fifth upou university faculty
office department college institute center centre de del dela la los san amid amidst person people
towards based various different way thing pro proceedings`
    .split(/\s+/)
    .map(stem),
)
// A tag naming an institution ("University of Minnesota") is not a topic.
const INSTITUTION: ReadonlySet<string> = new Set(
  'university college institute school academy department office center centre commission council foundation agency bureau ministry faculty'
    .split(' ')
    .map(stem),
)

const JOINERS = new Set(['of', 'and', 'in', 'for', 'on', 'the', 'to', '&'])
const PHRASE_BREAK = /[^\p{L}\p{N}\s'’‘`´&-]+/u
const LETTERS = /[^\p{L}]+/gu

/** All capitals across at least two words ("CLOSING CEREMONIES"); one capitalised word may be an acronym. */
const isShouty = (words: readonly string[]): boolean => {
  if (words.length < 2) return false
  const letters = words.join('').replace(LETTERS, '')
  return (
    letters.length > 4 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()
  )
}

/** In a shouting phrase "CLOSING" → "Closing" and "NG" → "ng"; short acronyms ("ODEL") stay. */
function calm(word: string, shouty: boolean, first = false): string {
  if (!shouty || word !== word.toUpperCase()) return word
  const lower = word.toLowerCase()
  if (STOPWORDS.has(lower)) return first ? word[0] + lower.slice(1) : lower
  return word.length > 4 ? word[0] + lower.slice(1) : word
}

const displayTag = (tag: string): string => {
  const words = tag.split(' ')
  return isShouty(words) ? words.map((w, i) => calm(w, true, i === 0)).join(' ') : tidyTag(tag)
}

/** `text` cut to `room` characters at a word boundary, with an ellipsis. */
function clip(text: string, room: number): string {
  if (text.length <= room) return text
  const cut = text.slice(0, room - 1)
  const space = cut.lastIndexOf(' ')
  const head = space > room / 2 ? cut.slice(0, space) : cut
  const tidy = head.replace(/\s+(?:and|of|the|for|in|on|at|to|a|an|by|with|from|&)$/i, '')
  return `${tidy.replace(/[\s,;:|–—-]+$/, '')}…`
}

const fit = (s: string): string => clip(s, MAX_REASON)

const isJoiner = (word: string) => JOINERS.has(word.toLowerCase())

/** The longest stretch of whole words that fits; ties go to the end ("Descriptive Statistics"). */
function fitWords(phrase: string, room: number): string {
  if (phrase.length <= room) return phrase
  const words = phrase.split(' ')
  let best = ''
  let bestSize = 0
  for (let i = 0; i < words.length; i++) {
    for (let j = words.length; j > i; j--) {
      const part = words.slice(i, j)
      while (part.length && isJoiner(part[0])) part.shift()
      while (part.length && isJoiner(part[part.length - 1])) part.pop()
      const text = part.join(' ')
      const size = part.filter((w) => !isJoiner(w)).length
      if (text && text.length <= room && size >= bestSize) {
        best = text
        bestSize = size
      }
    }
  }
  return best || clip(phrase, room)
}

const quoted = (prefix: string, text: string): string =>
  `${prefix} “${clip(text, Math.max(MIN_QUOTE, MAX_REASON - prefix.length - 3))}”`

/** The title without its speaker credit. */
const shortTitle = (v: Video): string => v.title.slice(0, bodyEnd(v.title)).trim()

const LEADING_LABEL =
  /^(?:episode|ep|part|pt|session|module|lesson|chapter|vol|volume|no)\.?\s*#?\d+\s*[|:–—-]?\s*/i

/**
 * The part of a title worth quoting: in a series, what follows its name ("FASTLearn Episode 29 –
 * Food Safety" → "Food Safety"), so a reason does not just repeat the series.
 */
function quotable(idx: Index, v: Video): string {
  const title = shortTitle(v)
  const key = seriesKeyOf(title)
  const sep = key && (idx.seriesSize.get(key) ?? 0) > 1 ? SEPARATOR_RE.exec(title) : null
  if (!sep) return title
  const rest = title
    .slice(sep.index + sep[0].length)
    .replace(LEADING_LABEL, '')
    .trim()
  return rest.length >= 8 ? rest : title
}

const idfOf = (idx: Index, term: string): number => {
  const id = idx.terms.get(term)
  return id === undefined ? 0 : idx.idf[id]
}

const lettersOf = (s: string): string[] => s.toLowerCase().split(LETTERS).filter(Boolean)

const HONORIFICS = new Set(
  'dr prof aprof asst assoc mr mrs ms atty engr arch sir hon dean director chancellor vice pres fr rev phd rn md jr sr ii iii iv'.split(
    ' ',
  ),
)

/** A video's people (person tags, the title's speaker credit), each as lowercase name words. */
function speakersOf(v: Video): Set<string>[] {
  const names = v.tags.filter((t) => isPersonTag(t))
  const credit = creditOf(v.title)
  if (credit) names.push(credit.name)
  return names.map(
    (name) => new Set(lettersOf(name).filter((w) => !HONORIFICS.has(w) && !PARTICLES.has(w))),
  )
}

const wordsOfPeople = (people: Set<string>[]): Set<string> => new Set(people.flatMap((p) => [...p]))

/** Someone both videos credit: two name words in common ("Noel Rosal", "Mayor Noel Rosal"). */
function sameSpeaker(a: Set<string>[], b: Set<string>[]): boolean {
  return a.some((x) =>
    b.some((y) => {
      let both = 0
      for (const w of x) if (y.has(w)) both++
      return both >= 2
    }),
  )
}

/** A title's body (speaker credit dropped) as phrases of words, split at punctuation. */
const phrasesOf = (title: string): string[][] =>
  title
    .slice(0, bodyEnd(title))
    .split(PHRASE_BREAK)
    .map((p) =>
      p
        .split(/\s+/)
        .map((w) => w.replace(EDGE, ''))
        .filter(Boolean),
    )

/** A title term worth naming: informative, not generic, nobody's name, no organisation. */
const usable = (idx: Index, term: string, word: string, people: ReadonlySet<string>): boolean =>
  idfOf(idx, term) > 0 &&
  !GENERIC_TERMS.has(term) &&
  !isName(term) &&
  !isNameToken(word) &&
  !people.has(word.toLowerCase()) &&
  !isOrgTag(word) &&
  !idx.programmes.has(tagKey(word))

/** The informative terms of a video's title, each with the word that spells it. */
function titleTermsOf(idx: Index, v: Video, people: ReadonlySet<string>): Map<string, string> {
  const out = new Map<string, string>()
  for (const phrase of phrasesOf(v.title)) {
    const shouty = isShouty(phrase)
    for (const word of phrase)
      for (const t of tokenize(word))
        if (!out.has(t) && usable(idx, t, word, people)) out.set(t, calm(word, shouty))
  }
  return out
}

interface Search {
  q: string
  ids: number[]
}

/** What every reason for one list needs to know about the video and the profile. */
interface Context {
  idx: Index
  video?: Video
  series?: string
  ownTags: Set<string>
  ownTerms: Map<string, string>
  ownSpeakers: Set<string>[]
  ownPeople: Set<string>
  watched: string[]
  saved: string[]
  /** Recent searches, newest first. */
  searches: Search[]
}

function contextOf(
  idx: Index,
  video: Video | null | undefined,
  profile: Profile | undefined,
): Context {
  // The video on screen is never its own reason.
  const other = (id: string) => id !== video?.id
  const speakers = video ? speakersOf(video) : []
  const people = wordsOfPeople(speakers)
  return {
    idx,
    video: video ?? undefined,
    series: video ? seriesOf(idx, video) : undefined,
    ownTags: video ? tagKeysOf(idx, video) : new Set(),
    ownTerms: video ? titleTermsOf(idx, video, people) : new Map(),
    ownSpeakers: speakers,
    ownPeople: people,
    watched: profile?.watched.map((e) => e.id).filter(other) ?? [],
    saved: profile?.saved.filter(other) ?? [],
    searches: (profile?.searches ?? [])
      .slice(0, RECENT_SEARCHES)
      .map((s) => ({ q: s.q, ids: queryTerms(idx, s.q) })),
  }
}

/** A tag fit to name as a topic: no organisation or institution, no name, not only generic words. */
function isTopic(tag: string, people: ReadonlySet<string>): boolean {
  if (isOrgTag(tag) || tag.split(/[\s/]+/).some((w) => isOrgTag(w))) return false
  const terms = tokenize(tag)
  if (terms.every((t) => GENERIC_TERMS.has(t)) || terms.some((t) => INSTITUTION.has(t)))
    return false
  // "Padolina", or a speaker the person-tag rules missed ("Jefferson Chua").
  return !lettersOf(tag).every((w) => isNameToken(w) || people.has(w))
}

const A_TOPIC = 'Shares a topic: '

interface Topics {
  names: string[]
  /** Both carry a programme's tag: another instalment of it. */
  programme: boolean
}

/** Topic tags both videos carry (minus their series' own), rarest first. */
function sharedTopics(
  ctx: Context,
  candidate: Video,
  theirPeople: ReadonlySet<string>,
  sameSeries: boolean,
): Topics {
  const { idx } = ctx
  const theirs = tagKeysOf(idx, candidate)
  const seriesTags = sameSeries && ctx.series ? idx.seriesTags.get(ctx.series) : undefined
  const people = new Set([...ctx.ownPeople, ...theirPeople])
  const seen = new Set<string>()
  const out: Topics = { names: [], programme: false }
  const sorted = [...candidate.tags].sort(
    (a, b) => (idx.tagDf.get(tagKey(a)) ?? 0) - (idx.tagDf.get(tagKey(b)) ?? 0),
  )
  for (const tag of sorted) {
    const k = tagKey(tag)
    if (seen.has(k) || !ctx.ownTags.has(k) || !theirs.has(k) || seriesTags?.has(k)) continue
    seen.add(k)
    if (idx.programmes.has(k)) {
      out.programme = true
      continue
    }
    const name = displayTag(tag)
    // A tag too long to show whole names an event or a title, not a topic.
    if (A_TOPIC.length + name.length > MAX_REASON || !isTopic(tag, people)) continue
    // A topic and its acronym ("Asia-Europe Meeting", "ASEM") are one topic: keep the words.
    const same = out.names.findIndex((n) => isAcronymOf(n, name) || isAcronymOf(name, n))
    if (same < 0) out.names.push(name)
    else if (isAcronymOf(out.names[same], name)) out.names[same] = name
  }
  return out
}

function topicReason(names: string[]): string {
  const two = names.length > 1 && `Shares topics: ${names[0]}, ${names[1]}`
  return two && two.length <= MAX_REASON ? two : A_TOPIC + names[0]
}

interface Shared {
  runs: string[]
  terms: string[]
  /** How many title words matched. */
  words: number
}

/** Adjacent title words both titles share, as phrases in the candidate's order ("Climate Change"). */
function sharedRuns(
  ctx: Context,
  candidate: Video,
  people: ReadonlySet<string>,
  except: ReadonlySet<string>,
): Shared {
  const out: Shared = { runs: [], terms: [], words: 0 }
  for (const phrase of phrasesOf(candidate.title)) {
    const shouty = isShouty(phrase)
    let run: string[] = []
    let gap = ''
    const flush = () => {
      if (run.length) out.runs.push(run.join(' '))
      run = []
      gap = ''
    }
    for (const word of phrase) {
      const subs = tokenize(word)
      const shared = subs.filter(
        (t) =>
          ctx.ownTerms.has(t) &&
          !except.has(t) &&
          !out.terms.includes(t) &&
          usable(ctx.idx, t, word, people),
      )
      if (shared.length) {
        if (gap) run.push(gap)
        gap = ''
        out.terms.push(...shared)
        out.words++
        // A shouting phrase borrows the other title's spelling ("ASEAN", "Closing").
        const own = ctx.ownTerms.get(shared[0])
        run.push(shouty && own?.toLowerCase() === word.toLowerCase() ? own : calm(word, shouty))
      } else if (!subs.length && run.length && !gap && isJoiner(word)) {
        gap = word.toLowerCase()
      } else flush()
    }
    flush()
  }
  return out
}

const ALSO_ABOUT = 'Also about '

/** "Also about Climate Change": two shared title words, one of them rare in the catalog. */
function titleReason(
  ctx: Context,
  candidate: Video,
  people: ReadonlySet<string>,
  sameSeries: boolean,
): string | undefined {
  if (ctx.ownTerms.size < MIN_TITLE_TERMS) return undefined
  // In one series its name is no topic ("Maikling Pelikula").
  const except = new Set(sameSeries && ctx.series ? tokenize(ctx.series) : [])
  const { runs, terms, words } = sharedRuns(ctx, candidate, people, except)
  if (words < MIN_TITLE_TERMS || !terms.some((t) => idfOf(ctx.idx, t) >= ctx.idx.rareIdf))
    return undefined
  const room = MAX_REASON - ALSO_ABOUT.length
  const ordered = runs
    .map((run, i) => ({ run, i, size: run.split(' ').length }))
    .sort((a, b) => b.size - a.size || a.i - b.i)
    .map((r) => r.run)
  let payload = fitWords(ordered[0], room)
  for (const run of ordered.slice(1)) {
    const next = `${payload}, ${run}`
    if (next.length > room) break
    payload = next
  }
  return ALSO_ABOUT + payload
}

/** The video among `ids` most similar to `candidate`, when similar enough; ties keep list order. */
function closest(idx: Index, candidate: Video, ids: readonly string[]): Video | undefined {
  if (!ids.length) return undefined
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

function matchesSearch(idx: Index, candidate: Video, search: Search): boolean {
  if (!search.ids.length) return false
  const { ids } = vectorOf(idx, candidate)
  return search.ids.every((id) => ids.includes(id))
}

const ACRONYM = /\(([^)]+)\)\s*$/

/** "More from Health Sciences"; a long name gives way to its acronym or to "this collection". */
function collectionReason(category: string, withVideo: boolean): string {
  const full = `More from ${category}`
  if (full.length <= MAX_REASON) return full
  const short = ACRONYM.exec(category)?.[1]
  if (short) return `More from ${short}`
  return withVideo ? 'More from this collection' : fit(full)
}

/** Every true reason for showing `candidate`, most specific first; the last is always generic. */
function reasonsFor(ctx: Context, candidate: Video): string[] {
  const { idx, video } = ctx
  const out: string[] = []
  if (video) {
    const speakers = speakersOf(candidate)
    const people = wordsOfPeople(speakers)
    const sameSeries = ctx.series !== undefined && seriesOf(idx, candidate) === ctx.series
    const { names: topics, programme } = sharedTopics(ctx, candidate, people, sameSeries)
    // In a short series the sequence is the point; in a long programme the topic says more.
    const seriesFirst =
      sameSeries && ((idx.seriesSize.get(ctx.series ?? '') ?? 0) <= SERIES_FULL || !topics.length)
    if (seriesFirst) out.push('Same series')
    if (topics.length) out.push(topicReason(topics))
    const about = titleReason(ctx, candidate, people, sameSeries)
    if (about) out.push(about)
    if ((sameSeries && !seriesFirst) || (programme && !sameSeries)) out.push('Same series')
    if (sameSpeaker(ctx.ownSpeakers, speakers)) out.push('Same speaker')
  }
  const searched = ctx.searches.find((s) => matchesSearch(idx, candidate, s))
  const watched = closest(idx, candidate, ctx.watched)
  const saved = closest(idx, candidate, ctx.saved)
  const bySearch = searched && quoted('Because you searched', searched.q)
  const byWatch = watched && quoted('Because you watched', quotable(idx, watched))
  const bySave = saved && quoted('Because you saved', quotable(idx, saved))
  // Without a video the latest search leads: "Recommended for you" keeps places for it.
  const searchFirst = !video && searched !== undefined && searched === ctx.searches[0]
  for (const r of searchFirst ? [bySearch, byWatch, bySave] : [byWatch, bySearch, bySave]) {
    if (r) out.push(r)
  }
  if (
    candidate.category !== GENERAL_CATEGORY &&
    (!video || video.category === candidate.category)
  ) {
    out.push(collectionReason(candidate.category, !!video))
  }
  // Never "Recommended for you": that is the heading of the row these cards sit in.
  out.push(video ? 'Related video' : tasteReason(ctx))
  return out
}

const tasteReason = ({ watched, searches, saved }: Context): string =>
  watched.length
    ? 'Based on what you watched'
    : searches.length
      ? 'Based on your searches'
      : saved.length
        ? 'Based on your list'
        : 'Picked for you'

// Rewordings for when every true reason of a row is used up.
const REWORDED: Record<string, readonly string[]> = {
  'Same series': ['Also in this series', 'From the same series'],
  'Related video': ['You may also like', 'Related'],
  'Based on what you watched': ['Picked for you', 'You may also like'],
  'Based on your searches': ['Picked for you', 'You may also like'],
  'Based on your list': ['Picked for you', 'You may also like'],
  'Picked for you': ['You may also like'],
}

const rewordingsOf = (text: string): readonly string[] =>
  REWORDED[text] ??
  (text.startsWith('More from ') ? ['From the same collection', 'Also in this collection'] : [])

/**
 * A short reason (≤ 40 characters where possible) for showing `candidate`: relative to the video
 * being watched when `video` is given, otherwise (or failing that) relative to the profile.
 */
export function explain(
  video: Video | null | undefined,
  candidate: Video,
  profile?: Profile,
): string {
  return reasonsFor(contextOf(getIndex(), video, profile), candidate)[0]
}

/**
 * Reasons for a whole list, one per item: explain() for each, except that no reason shows on three
 * rows in a row or more than three times in any eight rows (the row's next true reason takes over,
 * or else a rewording).
 */
export function explainList(
  video: Video | null | undefined,
  items: readonly Video[],
  profile?: Profile,
): string[] {
  const ctx = contextOf(getIndex(), video, profile)
  const out: string[] = []
  for (const item of items) {
    const n = out.length
    const recent = out.slice(-(SAME_WINDOW - 1))
    const repeats = (text: string) => n >= 2 && out[n - 1] === text && out[n - 2] === text
    const fresh = (text: string) =>
      !repeats(text) && recent.filter((r) => r === text).length < MAX_SAME
    const options = reasonsFor(ctx, item)
    const reason =
      options.find(fresh) ??
      options.flatMap(rewordingsOf).find(fresh) ??
      options.find((t) => !repeats(t)) ??
      options[0]
    out.push(reason)
  }
  return out
}

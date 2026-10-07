// Suggestions while typing in a search field: the likelier spelling of a misspelt query, then
// collections, topics and video titles that match the words so far (near spellings included).
import {
  getCategories,
  queryTerms,
  searchCatalog,
  searchWarmup,
  videos,
  warmSearch,
} from '../data/catalog'
import type { Video } from '../types'
import { correctionOf, matchTier, wordsOf, type Term } from './fuzzy'
import { isGenericTag, isOrgTag, tagKey, tidyTag } from './tags'

export type SuggestionKind = 'search' | 'collection' | 'topic' | 'video'

export interface Suggestion {
  kind: SuggestionKind
  label: string
  /** Where choosing it goes. */
  to: string
}

const MAX_COLLECTIONS = 2
const MAX_TOPICS = 2
// Longer tags are sentences or titles, not topics.
const MAX_TOPIC_LENGTH = 40

export const searchPath = (q: string) => `/search?q=${encodeURIComponent(q)}`

interface Topic {
  label: string
  field: string
  count: number
}

// Tags by key with their video counts, gathered once per catalog (see topicsWarmup), without
// housekeeping, organisation and people tags (the test is slow, so it runs here, not per key).
let topicsOf: { list: readonly Video[]; topics: Topic[] } | undefined
// Videos per step of topicsWarmup.
const TOPIC_STEP = 10

function* topicsWarmup(): Generator<void, void> {
  const list = videos
  if (topicsOf?.list === list) return
  // null: a tag that is not a topic.
  const byKey = new Map<string, Topic | null>()
  for (let i = 0; i < list.length; i++) {
    for (const raw of list[i].tags) {
      const tag = raw.trim()
      if (!tag || tag.length > MAX_TOPIC_LENGTH) continue
      const key = tagKey(tag)
      const topic = byKey.get(key)
      if (topic) topic.count++
      else if (topic === undefined) {
        const skip = isGenericTag(tag) || isOrgTag(tag)
        byKey.set(key, skip ? null : { label: tag, field: wordsOf(tag), count: 1 })
      }
    }
    if (i % TOPIC_STEP === TOPIC_STEP - 1) {
      yield
      if (videos !== list) return
    }
  }
  topicsOf = { list, topics: [...byKey.values()].filter((t) => t !== null) }
}

function topics(): Topic[] {
  if (topicsOf?.list !== videos) drain(topicsWarmup())
  return topicsOf?.topics ?? []
}

// Runs a stepwise job to the end at once.
function drain<T>(steps: Generator<void, T>): T {
  let step = steps.next()
  while (!step.done) step = steps.next()
  return step.value
}

/** Builds what suggestions use (search index, vocabulary, topics) ahead of the first keystroke. */
export function warmSuggestions(): void {
  warmSearch()
  topics()
}

/** warmSuggestions a step at a time, for a caller to spread over idle time. */
export function* suggestionsWarmup(): Generator<void, void> {
  yield* searchWarmup()
  yield
  yield* topicsWarmup()
}

// Every term must match; whole words beat word starts, then parts of words, then near spellings.
function scoreOf(field: string, terms: readonly Term[]): number {
  let score = 0
  for (const t of terms) {
    const tier = matchTier(field, t)
    if (!tier) {
      // A function word may be missing (as on the results page).
      if (t.optional) continue
      return 0
    }
    score += tier
  }
  return score
}

/** Up to `limit` suggestions for what has been typed so far. */
export const suggest = (query: string, limit = 6): Suggestion[] => drain(suggestSteps(query, limit))

/** suggest a scan at a time: it yields between them, for a caller to spread over several tasks. */
export function* suggestSteps(query: string, limit = 6): Generator<void, Suggestion[]> {
  const terms = queryTerms(query)
  if (!terms.length) return []
  yield
  const picked: Suggestion[] = []
  const taken = new Set<string>()
  const add = (kind: SuggestionKind, label: string, to: string) => {
    picked.push({ kind, label, to })
    taken.add(tagKey(label))
  }
  const topicMatches = topics()
    .map((topic) => ({ topic, score: scoreOf(topic.field, terms) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || b.topic.count - a.topic.count)
  yield

  // The fix first, unless a topic says the same ("Gender" for "gendr").
  const correction = correctionOf(terms)
  if (correction && !topicMatches.some((m) => tagKey(m.topic.label) === tagKey(correction))) {
    add('search', correction, searchPath(correction))
  }
  const collections = getCategories()
    .map((c) => ({ c, score: scoreOf(wordsOf(c.name), terms) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
  for (const { c } of collections.slice(0, MAX_COLLECTIONS)) {
    add('collection', c.name, `/collections/${c.slug}`)
  }
  const topicLabels: string[] = []
  for (const { topic } of topicMatches) {
    if (topicLabels.length === limit) break
    const key = tagKey(topic.label)
    if (taken.has(key)) continue
    topicLabels.push(topic.label)
    taken.add(key)
  }
  yield
  // Titles fill the rest, after room for two topics; topics take whatever titles leave.
  const room = limit - picked.length
  const titles = searchCatalog(query, {
    titles: true,
    limit: Math.max(0, room - Math.min(MAX_TOPICS, topicLabels.length)),
  }).videos
  for (const label of topicLabels.slice(0, room - titles.length)) {
    picked.push({ kind: 'topic', label: tidyTag(label), to: searchPath(label) })
  }
  for (const v of titles) picked.push({ kind: 'video', label: v.title, to: `/watch/${v.id}` })
  return picked
}

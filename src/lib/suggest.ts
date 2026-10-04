// Suggestions while typing in a search field: the likelier spelling of a misspelt query, then
// collections, topics and video titles that match the words so far (near spellings included).
import { getCategories, queryTerms, searchCatalog, videos, warmSearch } from '../data/catalog'
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

// Tags by key with their video counts, gathered on the first suggestion for each catalog.
// Housekeeping, organisation and people tags are dropped only as they match (the test is slow).
let topicsOf: { list: readonly Video[]; topics: Topic[] } | undefined
function topics(): Topic[] {
  if (topicsOf?.list === videos) return topicsOf.topics
  const byKey = new Map<string, Topic>()
  for (const video of videos) {
    for (const raw of video.tags) {
      const tag = raw.trim()
      if (!tag || tag.length > MAX_TOPIC_LENGTH) continue
      const key = tagKey(tag)
      const topic = byKey.get(key)
      if (topic) topic.count++
      else byKey.set(key, { label: tag, field: wordsOf(tag), count: 1 })
    }
  }
  topicsOf = { list: videos, topics: [...byKey.values()] }
  return topicsOf.topics
}

/** Builds what suggestions use (search index, vocabulary, topics) ahead of the first keystroke. */
export function warmSuggestions(): void {
  warmSearch()
  topics()
}

// Every term must match; whole words beat word starts, then parts of words, then near spellings.
function scoreOf(field: string, terms: readonly Term[]): number {
  let score = 0
  for (const t of terms) {
    const tier = matchTier(field, t)
    if (!tier) return 0
    score += tier
  }
  return score
}

/** Up to `limit` suggestions for what has been typed so far. */
export function suggest(query: string, limit = 6): Suggestion[] {
  const terms = queryTerms(query)
  if (!terms.length) return []
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
    if (taken.has(key) || isGenericTag(topic.label) || isOrgTag(topic.label)) continue
    topicLabels.push(topic.label)
    taken.add(key)
  }
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

// Tag clean-up shared by the reel's topic chips, the quick look, the watch page and the search
// page's popular topics.

/** Ignores case, spaces and punctuation, so "Tech Tips" matches "TechTips". */
export const tagKey = (tag: string) => tag.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

// WordPress housekeeping and brand tags that say nothing about the topic.
const GENERIC = new Set([
  'video',
  'videos',
  'videopost',
  'pastpost',
  'post',
  'lecture',
  'lectures',
  'videolecture',
  'educational',
  'elearning',
  'upopenuniversity',
  'upou',
  'upounetworks',
  'upoer',
  'tvup',
  'oer',
  'open',
  'university',
  'material',
  'materials',
  'compilation',
  'livestream',
])

/** Housekeeping, brand, numeric and very short tags: never shown as topics or chips. */
export const isGenericTag = (tag: string) => {
  const key = tagKey(tag)
  return key.length < 3 || /^\d+$/.test(key) || GENERIC.has(key)
}

// Faculties, offices, sponsors and people: fine as chips on a video, not as topics to browse by.
const ORG = new Set([
  'fmds',
  'facultyofmanagementanddevelopmentstudies',
  'facultyofeducation',
  'fed',
  'fics',
  'facultyofinformationandcommunicationstudies',
  'ched',
  'cep',
  'continuingeducationprogram',
  'pldt',
  'aspap',
  'eidr',
  'drdm',
  'iuptv',
  'upounetworksmultimediacenter',
  'bandalaria',
])

export const isOrgTag = (tag: string) =>
  ORG.has(tagKey(tag)) || /^(dr|prof|atty|engr)\.?\s/i.test(tag.trim())

/** Title-cases all-lowercase tags such as "open data"; mixed-case tags are left alone. */
export const tidyTag = (tag: string) =>
  tag === tag.toLowerCase() ? tag.replace(/\b[a-z]/g, (c) => c.toUpperCase()) : tag

/** A video's tags as chips: housekeeping dropped, duplicates merged, tidied, capped. */
export function topicTags(tags: readonly string[], limit = 10): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const tag = raw.trim()
    const key = tagKey(tag)
    if (!key || seen.has(key) || isGenericTag(tag)) continue
    seen.add(key)
    out.push(tidyTag(tag))
    if (out.length === limit) break
  }
  return out
}

/** Hand-picked subjects for "Popular topics", strongest first; each is a search query. */
export const POPULAR_TOPICS: readonly string[] = [
  'ODeL',
  'MOOCs',
  'ASEAN',
  'Agriculture',
  'Gender',
  'Health',
  'Communication',
  'Math',
  'Public management',
  'Ethics',
  'Filipino',
  'Climate change',
  'Environment',
  'Research',
  'Business',
  'Art',
]

/** Recurring programmes worth browsing as a set; each is a search query. */
export const POPULAR_SERIES: readonly string[] = [
  'FASTLearn',
  '100 Master Voices',
  'Akdang Buhay',
  "Let's Talk It Over",
  'OPEN Talk',
  'MicroLearning',
  'TechTips',
  'Student Orientation',
]

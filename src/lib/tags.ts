// Tag clean-up shared by the reel's topic chips and the search page's popular topics.

/** Ignores case, spaces and punctuation, so "Tech Tips" matches "TechTips". */
export const tagKey = (tag: string) => tag.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

// WordPress tags that say nothing about the topic.
const GENERIC = new Set([
  'video',
  'videos',
  'videopost',
  'pastpost',
  'lecture',
  'lectures',
  'videolecture',
  'educational',
])

export const isGenericTag = (tag: string) => GENERIC.has(tagKey(tag))

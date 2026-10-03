import { hashString } from '../lib/seed'
import type { CatalogRecord, Video } from '../types'

export const DEFAULT_CHANNEL = 'UP Open University'
export const SOURCE_ORIGIN = 'https://oer.upou.edu.ph'

const ID_RE = /^[a-z0-9-]+$/
const YOUTUBE_ID_RE = /^[\w-]{11}$/

const image = (youtubeId: string, name: string) => `https://i.ytimg.com/vi/${youtubeId}/${name}.jpg`

// Drawn once per page load, so every refresh shows a different member of each thumbnail set.
let loadSeed = Math.floor(Math.random() * 1e9)

/** Test hook: fixes which member of each thumbnail set is shown. */
export const setLoadSeed = (seed: number) => {
  loadSeed = seed
}

/** All thumbnail candidates of a video; the original YouTube thumbnail is first. */
export const thumbnailSetOf = (video: Video): string[] => video.thumbnails ?? [video.thumbnail]

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isVideo = (value: unknown): value is Video => isObject(value) && 'youtubeId' in value

const text = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

/** The fields the UI relies on; the crawler guarantees the rest. */
export const isValidRecord = (value: unknown): value is CatalogRecord =>
  isObject(value) &&
  typeof value.id === 'string' &&
  ID_RE.test(value.id) &&
  typeof value.y === 'string' &&
  YOUTUBE_ID_RE.test(value.y) &&
  text(value.t) &&
  text(value.c) &&
  typeof value.p === 'string' &&
  !Number.isNaN(Date.parse(value.p))

/** Derives the full Video (image and source URLs, defaults) from a slim catalog record. */
export function expandRecord(r: CatalogRecord): Video {
  const hiRes = r.m !== 0
  // The set is the YouTube thumbnail plus its three still frames; small and large share an index.
  const small = ['mqdefault', 'mq1', 'mq2', 'mq3'].map((n) => image(r.y, n))
  const large = [
    r.b ?? image(r.y, hiRes ? 'maxresdefault' : 'mqdefault'),
    ...[1, 2, 3].map((n) => image(r.y, `${hiRes ? 'maxres' : 'mq'}${n}`)),
  ]
  const n = small.length
  const pick = (((hashString(r.id) + loadSeed) % n) + n) % n
  return {
    id: r.id,
    youtubeId: r.y,
    title: r.t,
    description: r.d ?? '',
    category: r.c,
    tags: r.g ?? [],
    channel: r.ch ?? DEFAULT_CHANNEL,
    publishedAt: r.p,
    sourceUrl: `${SOURCE_ORIGIN}/${r.id}/`,
    thumbnail: small[pick],
    thumbnails: small,
    // Low-res videos keep their one good backdrop (og:image) instead of a 320px frame.
    backdrop: hiRes ? large[pick] : large[0],
    frames: large.slice(1),
    ...(r.f ? { featured: true } : {}),
  }
}

/**
 * Expands a catalog, skipping malformed records with a warning instead of crashing.
 * Already-expanded videos (test fixtures) pass through unchanged.
 */
export function expandCatalog(records: readonly unknown[]): Video[] {
  const videos: Video[] = []
  for (const record of records) {
    if (isVideo(record)) videos.push(record)
    else if (isValidRecord(record)) videos.push(expandRecord(record))
    else console.warn('Skipping malformed catalog record', record)
  }
  return videos
}

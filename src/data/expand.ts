import type { CatalogRecord, Video } from '../types'

export const DEFAULT_CHANNEL = 'UP Open University'
export const SOURCE_ORIGIN = 'https://oer.upou.edu.ph'

const ID_RE = /^[a-z0-9-]+$/
const YOUTUBE_ID_RE = /^[\w-]{11}$/

const image = (youtubeId: string, name: string) => `https://i.ytimg.com/vi/${youtubeId}/${name}.jpg`

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
  const quality = r.m === 0 ? 'mq' : 'maxres'
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
    thumbnail: image(r.y, 'mqdefault'),
    backdrop: r.b ?? image(r.y, r.m === 0 ? 'mqdefault' : 'maxresdefault'),
    frames: [1, 2, 3].map((n) => image(r.y, `${quality}${n}`)),
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

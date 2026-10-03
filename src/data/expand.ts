import { hashString } from '../lib/seed'
import type { CatalogRecord, Video } from '../types'
import { flaggedMaskOf } from './frameFlags'

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
  // Without 1280px stills, the 640px "sd" ones (4:3 letterboxed; object-fit: cover crops the bars)
  // still beat the 320px thumbnails when enlarged; `s: 0` marks videos that lack those too.
  const small = ['mqdefault', 'mq1', 'mq2', 'mq3'].map((n) => image(r.y, n))
  const size = hiRes ? 'maxres' : r.s === 0 ? 'mq' : 'sd'
  const large = [
    r.b ?? image(r.y, `${size}default`),
    ...[1, 2, 3].map((n) => image(r.y, `${size}${n}`)),
  ]
  // Candidates that catch a face not smiling (frameFlags.ts) stay out of the rotation and the reel;
  // the original thumbnail remains the fallback when every candidate is flagged.
  const mask = flaggedMaskOf(r.y)
  const unflagged = (indexes: number[]) => indexes.filter((i) => !(mask & (1 << i)))
  const choices = unflagged([0, 1, 2, 3])
  const pool = choices.length ? choices : [0]
  const n = pool.length
  const pick = pool[(((hashString(r.id) + loadSeed) % n) + n) % n]
  // The reel plays three shots: repeat the remaining stills, or show the canonical image when none remain.
  const stills = unflagged([1, 2, 3])
  const shots = stills.length ? [0, 1, 2].map((k) => stills[k % stills.length]) : [0, 0, 0]
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
    // The original first (hero slots and lists use it), then the small versions of the reel shots.
    thumbnails: [small[0], ...shots.map((i) => small[i])],
    // A source-site backdrop (og:image) is kept over the rotating 640px frames.
    backdrop: !hiRes && r.b ? r.b : large[pick],
    frames: shots.map((i) => large[i]),
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

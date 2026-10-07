import { hashString } from '../lib/seed'
import type { CatalogRecord, Video } from '../types'
import { frameFlagsOf } from './frameFlags'
import { videoImages, type VideoImages } from './images'
import { isObject, isValidRecord, tidyTitle } from './records'

export { isValidRecord }

export const DEFAULT_CHANNEL = 'UP Open University'
export const SOURCE_ORIGIN = 'https://oer.upou.edu.ph'

// Drawn once per page load, so every refresh shows a different member of each thumbnail set.
let loadSeed = Math.floor(Math.random() * 1e9)

/** Test hook: fixes which member of each thumbnail set is shown. */
export const setLoadSeed = (seed: number) => {
  loadSeed = seed
}

/** All thumbnail candidates of a video; the canonical one (see images.ts) is first. */
export const thumbnailSetOf = (video: Video): string[] => video.thumbnails ?? [video.thumbnail]

const isVideo = (value: unknown): value is Video => isObject(value) && 'youtubeId' in value

// The image fields are worked out on first read: a page shows a few hundred videos at most, so
// startup skips that work for the rest of the catalog. Flags and seed are taken at expansion.
interface Pending {
  record: CatalogRecord
  flags: number
  turn: number
  images?: VideoImages
}
const pending = new WeakMap<object, Pending>()

const imagesOf = (video: object): VideoImages => {
  const p = pending.get(video)!
  return (p.images ??= videoImages(p.record, p.flags, p.turn))
}

const IMAGE_FIELDS = ['thumbnail', 'thumbnails', 'backdrop', 'poster', 'frames', 'slides'] as const
// Enumerable getters, so spreads, JSON and test equality still see the values.
const LAZY_IMAGES: PropertyDescriptorMap = Object.fromEntries(
  IMAGE_FIELDS.map((key) => [
    key,
    {
      enumerable: true,
      get(this: object) {
        return imagesOf(this)[key]
      },
    },
  ]),
)

/** Derives the full Video (image and source URLs, defaults) from a slim catalog record. */
export function expandRecord(r: CatalogRecord): Video {
  const video = {
    id: r.id,
    youtubeId: r.y,
    title: tidyTitle(r.t),
    description: r.d ?? '',
    category: r.c,
    tags: r.g ?? [],
    channel: r.ch ?? DEFAULT_CHANNEL,
    publishedAt: r.p,
    sourceUrl: `${SOURCE_ORIGIN}/${r.id}/`,
    ...(r.f ? { featured: true } : {}),
  }
  // Frame flags (frameFlags.ts) keep unfit frames out and rank the rest; the seed rotates them.
  pending.set(video, { record: r, flags: frameFlagsOf(r.y), turn: hashString(r.id) + loadSeed })
  return Object.defineProperties(video, LAZY_IMAGES) as Video
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

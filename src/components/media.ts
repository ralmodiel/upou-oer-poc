import type { CSSProperties } from 'react'
import { getCategoryByName, getLatest } from '../data/catalog'
import { thumbnailSetOf } from '../data/expand'
import { cropZoomOf, flaggedMaskOf } from '../data/frameFlags'
import { slotImages, widthOf, type SlotImages } from '../data/images'
import type { Video } from '../types'
import { toneOf, type Tone } from './tones'

/** Route slug of a category name (names that collide after slugifying get a suffix). */
export const slugOfCategory = (name: string) => getCategoryByName(name)?.slug ?? ''

// Title tiles and title-card reels use the collection's band colour; charcoal would read as a dark
// box among stills.
const TILE_TONE: Record<Tone, Tone> = {
  maroon: 'maroon',
  forest: 'forest',
  gold: 'gold',
  charcoal: 'maroon',
}

/** The band tone of a video's title tile and title-card reel: its collection's, never charcoal. */
export const tileToneOf = (video: Video): Tone => TILE_TONE[toneOf(slugOfCategory(video.category))]

export { widthOf }
export type { SlotImages }

export const hasHiRes = (video: Video) => widthOf(video.backdrop) >= 640

/** The best image for a large slot. */
export const largeImageOf = (video: Video) => (hasHiRes(video) ? video.backdrop : video.thumbnail)

// A rotating still frame (`maxres1.jpg` …); the original is `…default.jpg` next to it.
const FRAME = /\/(maxres|sd|mq)[123]\.jpg(\?|$)/

// Candidate index as in frame-flags.json: YouTube's still frames are 1-3; anything else (the
// original at any size, or the source site's og:image) is the original, 0.
const candidateOf = (src: string) =>
  Number(/\/(?:maxres|sd|hq|mq)([1-3])\.jpg(\?|$)/.exec(src)?.[1] ?? 0)

/** False for a missing image or one the frame filter flagged (a face not smiling or angry). */
const isClean = (video: Video, src: string | undefined): src is string =>
  !!src && !(flaggedMaskOf(video.youtubeId) & (1 << candidateOf(src)))

/**
 * The canonical large image of a video for hero slots (the featured block, the quick look and
 * their backdrops): its poster (the original, or the first clean still when that is flagged),
 * never a rotating still that could be a flash or near-black frame, and never a flagged image:
 * null when every image is flagged (the slot shows its plain well).
 */
export function heroImageOf(video: Video): string | null {
  const original = video.backdrop.replace(FRAME, '/$1default.jpg$2')
  const fallback = widthOf(original) >= 640 ? original : thumbnailSetOf(video)[0]
  return [video.poster, fallback, ...video.frames].find((src) => isClean(video, src)) ?? null
}

/**
 * Inline style for a 16:9 image whose baked-in black bars a zoom pushes out of its box (see
 * `cropZoomOf`); `--zoom` also lets a slide shown whole clip the bars it pushes past its edges.
 */
export const zoomStyle = (zoom: number): CSSProperties | undefined =>
  zoom > 1 ? ({ '--zoom': zoom, scale: 'var(--zoom)' } as CSSProperties) : undefined

/**
 * Sources for a 16:9 slot: this page load's pick from the thumbnail set, or with `canonical` the
 * hero image (hero slots and lists, where one odd frame stands out). Null when the slot has no
 * clean image (every image of the video flagged); see `thumbnailOf` for a video's own picture.
 */
export function imagesOf(video: Video, canonical = false): SlotImages | null {
  // The data falls back to the flagged original when nothing else is left: never show it.
  if (!canonical && !isClean(video, video.thumbnail)) return imagesOf(video, true)
  const large = canonical ? heroImageOf(video) : largeImageOf(video)
  if (!large) return null
  // The 320px member of the same candidate (any clean one, else the large image itself).
  const small = canonical
    ? (thumbnailSetOf(video).find(
        (s) => candidateOf(s) === candidateOf(large) && isClean(video, s),
      ) ?? large)
    : video.thumbnail
  return slotOf(small, large)
}

const slotOf = (small: string, large: string) => slotImages(small, large, cropZoomOf)

/**
 * A video's own picture (its card, list row, featured image): the clean images `imagesOf` picks,
 * else the least bad one (the data's poster) rather than a plain colour tile. Covers and backdrops
 * keep to clean images, and reels and previews never use a flagged frame.
 */
export function thumbnailOf(video: Video, canonical = false): SlotImages {
  const clean = imagesOf(video, canonical)
  if (clean) return clean
  const large = video.poster ?? video.thumbnail
  const small = thumbnailSetOf(video).find((s) => candidateOf(s) === candidateOf(large))
  return slotOf(small ?? video.thumbnail, large)
}

const NEW_COUNT = 10
// Keyed by the memoized array, so a catalog swap (tests) invalidates it.
const newSets = new WeakMap<readonly Video[], Set<string>>()

/** Whether a video is among the ten newest in the catalog. */
export function isNew(id: string): boolean {
  const latest = getLatest(NEW_COUNT)
  let set = newSets.get(latest)
  if (!set) {
    set = new Set(latest.map((v) => v.id))
    newSets.set(latest, set)
  }
  return set.has(id)
}

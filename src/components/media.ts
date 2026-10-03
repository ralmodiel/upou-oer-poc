import { getCategoryByName, getLatest } from '../data/catalog'
import { thumbnailSetOf } from '../data/expand'
import { flaggedMaskOf } from '../data/frameFlags'
import type { Video } from '../types'

/** Route slug of a category name (names that collide after slugifying get a suffix). */
export const slugOfCategory = (name: string) => getCategoryByName(name)?.slug ?? ''

// Pixel width of a YouTube still by its name. Source-site images (og:image) are featured images
// of at least 1200px, so anything that is not a known small YouTube still counts as large.
const SMALL = /\/mq(default|[123])\.jpg(\?|$)/
const WIDTHS: [RegExp, number][] = [
  [/\/maxres(default|[123])\.jpg(\?|$)/, 1280],
  [/\/sd(default|[123])\.jpg(\?|$)/, 640],
  [/\/hq(default|[123])\.jpg(\?|$)/, 480],
]
export const widthOf = (url: string) =>
  SMALL.test(url) ? 320 : (WIDTHS.find(([re]) => re.test(url))?.[1] ?? 1280)

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

// The 640px "sd" version of a 1280px YouTube still (YouTube serves both sizes whenever the large
// one exists; its 4:3 letterbox bars fall outside a 16:9 slot), for 2x screens and mid-size slots.
const SD = /\/maxres(default|[123])\.jpg(\?|$)/
const sdOf = (url: string) => (SD.test(url) ? url.replace('/maxres', '/sd') : null)

export interface SlotImages {
  small: string
  large: string
  srcSet: string | undefined
}

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

function slotOf(small: string, large: string): SlotImages {
  const width = widthOf(large)
  const sd = sdOf(large)
  const srcSet =
    width >= 640
      ? [`${small} 320w`, sd && `${sd} 640w`, `${large} ${width}w`].filter(Boolean).join(', ')
      : undefined
  return { small, large, srcSet }
}

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

import { getCategoryByName, getLatest } from '../data/catalog'
import { thumbnailSetOf } from '../data/expand'
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

/**
 * The canonical large image of a video (og:image or `…default.jpg`) for hero slots: the featured
 * block, the quick look and their backdrops. Never one of the rotating still frames, which can be
 * a flash or near-black frame that colours a whole page.
 */
export function heroImageOf(video: Video): string {
  const original = video.backdrop.replace(FRAME, '/$1default.jpg$2')
  return widthOf(original) >= 640 ? original : thumbnailSetOf(video)[0]
}

/**
 * Sources for a 16:9 slot: this page load's pick from the thumbnail set, or with `canonical` the
 * original images (hero slots and lists, where one odd frame stands out).
 */
export function imagesOf(video: Video, canonical = false) {
  const small = canonical ? thumbnailSetOf(video)[0] : video.thumbnail
  const large = canonical ? heroImageOf(video) : largeImageOf(video)
  const width = widthOf(large)
  return { small, large, srcSet: width >= 640 ? `${small} 320w, ${large} ${width}w` : undefined }
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

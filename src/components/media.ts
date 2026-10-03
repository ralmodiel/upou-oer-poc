import { getCategoryByName, getLatest } from '../data/catalog'
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

/** `srcSet` for a 16:9 image slot, or undefined when only the 320px thumbnail is trustworthy. */
export const srcSetOf = (video: Video) =>
  hasHiRes(video)
    ? `${video.thumbnail} 320w, ${video.backdrop} ${widthOf(video.backdrop)}w`
    : undefined

/** The best image for a large slot. */
export const largeImageOf = (video: Video) => (hasHiRes(video) ? video.backdrop : video.thumbnail)

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

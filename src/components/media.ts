import { getCategoryByName, getLatest } from '../data/catalog'
import type { Video } from '../types'

/** Route slug of a category name (names that collide after slugifying get a suffix). */
export const slugOfCategory = (name: string) => getCategoryByName(name)?.slug ?? ''

// Only YouTube's maxresdefault stills are really 1280px wide; other backdrops are 320px frames
// or source-site images of unknown size, so they are never advertised as 1280w.
const HI_RES = /\/maxresdefault\.jpg(\?|$)/

export const hasHiRes = (video: Video) => HI_RES.test(video.backdrop)

/** `srcSet` for a 16:9 image slot, or undefined when only the 320px thumbnail is trustworthy. */
export const srcSetOf = (video: Video) =>
  hasHiRes(video) ? `${video.thumbnail} 320w, ${video.backdrop} 1280w` : undefined

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

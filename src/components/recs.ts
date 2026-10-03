// Thin adapter over the recommender (src/lib/recommend.ts), so the browse UI has one place to
// ask for titles and reasons.
import { createContext } from 'react'
import { similarTo } from '../data/catalog'
import { isEmptyProfile, type Profile } from '../lib/history'
import { explain, recommendFor, recommendForProfile, warmRecommender } from '../lib/recommend'
import type { Video } from '../types'

interface LikeOptions {
  profile?: Profile
  limit: number
  exclude?: Iterable<string>
}

/** Titles like `video`, best first; the old category/tag ranking fills any shortfall. */
export function moreLikeThis(video: Video, { profile, limit, exclude }: LikeOptions): Video[] {
  const picked = recommendFor(video, { profile, limit, exclude })
  if (picked.length >= limit) return picked
  const seen = new Set([...picked.map((v) => v.id), ...(exclude ?? [])])
  const rest = similarTo(video, undefined, limit + seen.size).filter((v) => !seen.has(v.id))
  return [...picked, ...rest].slice(0, limit)
}

/** Unwatched titles for this browser's taste; empty for a fresh profile. */
export const forYou = (profile: Profile, limit: number): Video[] =>
  isEmptyProfile(profile) ? [] : recommendForProfile(profile, { limit })

/** One-line reasons keyed by video id, for card eyebrows. */
export function reasonsFor(
  list: readonly Video[],
  profile: Profile,
  video?: Video,
): Map<string, string> {
  return new Map(list.map((v) => [v.id, explain(video, v, profile)]))
}

/** Per-card reasons ("Because you watched …") that replace the category eyebrow in a grid. */
export const CardReasons = createContext<ReadonlyMap<string, string> | null>(null)

export { warmRecommender }

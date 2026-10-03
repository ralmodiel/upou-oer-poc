// Thin adapter over the recommender (src/lib/recommend.ts), so the browse UI has one place to
// ask for titles and reasons.
import { createContext, useEffect } from 'react'
import { similarTo } from '../data/catalog'
import { isEmptyProfile, type Profile } from '../lib/history'
import {
  explainList,
  isNearDuplicate,
  recommendFor,
  recommendForProfile,
  warmRecommenderAsync,
} from '../lib/recommend'
import type { Video } from '../types'
import { onIdle } from './browse-hooks'

const INTENT_EVENTS = ['pointerdown', 'keydown', 'scroll'] as const

/**
 * The recommender indexes the catalog on first use, in short slices. Start it when the browser is
 * idle after the visitor first interacts: never during page load, and usually before the first
 * quick look or player needs it. Mounted once (AppLayout).
 */
export function useWarmRecommender() {
  useEffect(() => {
    let cancelIdle = () => {}
    const stopListening = () =>
      INTENT_EVENTS.forEach((type) => window.removeEventListener(type, start, true))
    function start() {
      stopListening()
      cancelIdle = onIdle(() => void warmRecommenderAsync(), 4000)
    }
    INTENT_EVENTS.forEach((type) =>
      window.addEventListener(type, start, { capture: true, passive: true }),
    )
    return () => {
      stopListening()
      cancelIdle()
    }
  }, [])
}

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
  const rest = similarTo(video, undefined, limit + seen.size).filter(
    (v) => !seen.has(v.id) && !picked.some((p) => isNearDuplicate(p, v)),
  )
  return [...picked, ...rest].slice(0, limit)
}

/** Unwatched titles for this browser's taste, none of `exclude`; empty for a fresh profile. */
export const forYou = (profile: Profile, limit: number, exclude?: Iterable<string>): Video[] =>
  isEmptyProfile(profile) ? [] : recommendForProfile(profile, { limit, exclude })

/** One-line reasons keyed by video id, for card eyebrows (varied along the list). */
export function reasonsFor(
  list: readonly Video[],
  profile: Profile,
  video?: Video,
): Map<string, string> {
  const reasons = explainList(video, list, profile)
  return new Map(list.map((v, i) => [v.id, reasons[i]]))
}

/** Per-card reasons ("Because you watched …") that replace the category eyebrow in a grid. */
export const CardReasons = createContext<ReadonlyMap<string, string> | null>(null)

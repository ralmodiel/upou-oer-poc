import { getCategoryByName, getCategoryVideos, getLatest, similarTo } from '../../data/catalog'
import type { Profile } from '../../lib/history'
import { explainList, isNearDuplicate, recommendFor } from '../../lib/recommend'
import type { Video } from '../../types'

// Kept here for older imports; the grouping now lives in the recommender.
export { titleKey } from '../../lib/recommend'

export interface UpNextItem {
  video: Video
  /** Short reason for the pick ("Same series", "Shares a topic: …"); empty when there is none. */
  reason: string
}

// On the watch page "More from <collection>" always names the one being watched.
const onWatchPage = (reason: string) =>
  reason.startsWith('More from ') ? 'More from this collection' : reason

const sameTitle = (a: Video, b: Video) =>
  a.title.trim().toLowerCase() === b.title.trim().toLowerCase()

/** Adds `v` to `picks` unless the list is full, it is the video itself or a talk already in. */
function taker(video: Video, picks: Video[], limit: number) {
  return (v: Video) => {
    if (picks.length === limit || v.id === video.id || sameTitle(v, video)) return
    if (picks.some((p) => p.id === v.id || isNearDuplicate(p, v))) return
    picks.push(v)
  }
}

/**
 * The aside's picks: the recommender, personalised by this browser's profile and skipping
 * watched videos, then (it never pads with noise) the same collection and the newest videos.
 * One row per talk: speaker cuts, re-uploads and near-identical titles show once.
 */
export function upNextFor(video: Video, profile: Profile, limit = 8): UpNextItem[] {
  const exclude = profile.watched.map((e) => e.id)
  const picks: Video[] = []
  const take = taker(video, picks, limit)
  recommendFor(video, { profile, limit: limit * 2, exclude }).forEach(take)
  if (picks.length < limit) {
    similarTo(video, undefined, limit * 2).forEach(take)
    getLatest(limit * 2).forEach(take)
  }
  return explainList(video, picks, profile).map((reason, i) => ({
    video: picks[i],
    reason: onWatchPage(reason),
  }))
}

/**
 * Stand-in rows while the recommender builds its index (see UpNext): the collection's newest, then
 * the newest overall, one row per talk. Cheap, and the same number of rows as upNextFor.
 */
export function upNextPlaceholder(video: Video, limit = 8): UpNextItem[] {
  const picks: Video[] = []
  const take = taker(video, picks, limit)
  const category = getCategoryByName(video.category)
  for (const v of category ? getCategoryVideos(category.slug) : []) {
    if (picks.length === limit) break
    take(v)
  }
  if (picks.length < limit) getLatest(limit * 2).forEach(take)
  return picks.map((v) => ({ video: v, reason: '' }))
}

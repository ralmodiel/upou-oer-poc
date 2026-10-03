import { getLatest, similarTo } from '../../data/catalog'
import type { Profile } from '../../lib/history'
import { explain, recommendFor } from '../../lib/recommend'
import type { Video } from '../../types'

export interface UpNextItem {
  video: Video
  /** Short reason for the pick ("Same series", "Shares topics: …"); empty when there is none. */
  reason: string
}

/**
 * The aside's picks: the recommender, personalised by this browser's profile and skipping
 * watched videos. It never pads with noise, so short lists are filled from the same collection,
 * then from the newest videos.
 */
export function upNextFor(video: Video, profile: Profile, limit = 8): UpNextItem[] {
  const exclude = profile.watched.map((e) => e.id)
  const picks = recommendFor(video, { profile, limit, exclude })
  if (picks.length < limit) {
    const seen = new Set([video.id, ...picks.map((v) => v.id)])
    const fill = [
      ...similarTo(video, undefined, limit + seen.size),
      ...getLatest(limit + seen.size),
    ]
    for (const v of fill) {
      if (picks.length === limit) break
      if (!seen.has(v.id)) {
        seen.add(v.id)
        picks.push(v)
      }
    }
  }
  return picks.map((v) => ({ video: v, reason: explain(video, v, profile) }))
}

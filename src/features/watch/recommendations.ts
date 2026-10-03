import {
  getCategoryByName,
  getCategoryVideos,
  getLatest,
  getVideo,
  similarTo,
} from '../../data/catalog'
import type { Profile } from '../../lib/history'
import { explainList, isNearDuplicate, isRecommenderReady, recommendFor } from '../../lib/recommend'
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

/**
 * Up next frozen as a playlist once one of its rows is chosen. It travels in history state, so
 * Back, Forward and reload keep it, each entry with its own current row.
 */
export interface Playlist {
  /** The video whose page first listed these. */
  from: string
  ids: string[]
}

/** The playlist in a location's state when it lists `id`, else null (anything malformed too). */
export function playlistIn(state: unknown, id: string): Playlist | null {
  if (!state || typeof state !== 'object') return null
  const playlist: unknown = (state as { playlist?: unknown }).playlist
  if (!playlist || typeof playlist !== 'object') return null
  const { from, ids } = playlist as { from?: unknown; ids?: unknown }
  if (typeof from !== 'string' || !Array.isArray(ids)) return null
  const list = ids.filter((x): x is string => typeof x === 'string')
  return list.includes(id) ? { from, ids: list } : null
}

/** `state` (any other keys kept) with its playlist set. */
export const withPlaylist = (state: unknown, playlist: Playlist) => ({
  ...(state && typeof state === 'object' ? state : {}),
  playlist,
})

const reasonsAfter = (origin: Video, videos: Video[], profile: Profile) =>
  isRecommenderReady() ? explainList(origin, videos, profile).map(onWatchPage) : []

/**
 * A playlist's rows, ids no longer in the catalog dropped. Reasons are relative to the video that
 * first listed them, when the recommender is ready (else the collection eyebrows stand in).
 */
export function playlistRows(
  ids: readonly string[],
  origin: Video,
  profile: Profile,
): UpNextItem[] {
  const videos = ids.map((id) => getVideo(id)).filter((v): v is Video => !!v)
  const reasons = reasonsAfter(origin, videos, profile)
  return videos.map((v, i) => ({ video: v, reason: reasons[i] ?? '' }))
}

/**
 * Up to `count` more picks for `origin` after the rows listed: none listed already, never
 * `current`, one row per talk. Their reasons continue the list's.
 */
export function moreUpNext(
  origin: Video,
  current: Video,
  listed: readonly UpNextItem[],
  profile: Profile,
  count = 8,
): UpNextItem[] {
  const shown = listed.map((i) => i.video)
  const picks: Video[] = []
  const take = (v: Video) => {
    if (picks.length === count || v.id === current.id || sameTitle(v, current)) return
    if ([...shown, ...picks].some((p) => p.id === v.id || isNearDuplicate(p, v))) return
    picks.push(v)
  }
  upNextFor(origin, profile, shown.length + count * 2 + 1).forEach(({ video: v }) => take(v))
  const reasons = reasonsAfter(origin, [...shown, ...picks], profile).slice(shown.length)
  return picks.map((v, i) => ({ video: v, reason: reasons[i] ?? '' }))
}

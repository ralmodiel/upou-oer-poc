import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { onIdle } from '../../components/browse-hooks'
import { getVideo } from '../../data/catalog'
import type { Profile } from '../../lib/history'
import { isRecommenderReady, warmRecommenderAsync } from '../../lib/recommend'
import { usePersistentState } from '../../lib/storage'
import type { Video } from '../../types'
import {
  moreUpNext,
  playlistIn,
  playlistRows,
  upNextFor,
  upNextPlaceholder,
  withPlaylist,
  type Playlist,
  type UpNextItem,
} from './recommendations'

const without = (ids: readonly string[], id: string) => ids.filter((x) => x !== id)

// Rows More… adds at a time.
const MORE = 8

/** Whether the next video plays when one ends: off unless turned on (only a stored true is on). */
export function useAutoplay() {
  const [stored, setStored] = usePersistentState<unknown>('upou:autoplay', true)
  return [stored === true, (on: boolean) => setStored(on)] as const
}

interface Rows {
  items: UpNextItem[]
  /** The recommender's picks or a playlist (else the stand-ins shown while its index builds). */
  final: boolean
}

export interface UpNextList {
  items: UpNextItem[]
  /** Whether the rows are the final ones (the picks or a playlist), not the stand-ins. */
  final: boolean
  /** Whether More… has rows to add: null while the recommender's index builds, false once none are left. */
  more: boolean | null
  /** The playlist this page was opened from (null when it computed its own list). */
  playlist: Playlist | null
  /** The list as a playlist, for links into it: `ids` as shown, `from` its origin. */
  asPlaylist: () => Playlist
  /** Adds the next picks to the end (on a playlist page, kept in history state); returns them. */
  append: () => UpNextItem[]
  /** Swaps the rows for picks for this video not shown yet (back to the first ones once none are
   * left), leaving a playlist behind; null while the recommender's index builds. */
  refresh: (() => void) | null
  /** Works out the next picks in idle time, ahead of a likely More… (pointer or focus on it). */
  prefetch: () => void
  listRef: RefObject<HTMLOListElement | null>
}

/**
 * The Up next list of a watch page. Picked once per video (the watch page keys this by video) with
 * the profile of that moment, so it is not re-ranked while watching. On a cold visit the
 * recommender's index is not built yet, and building it at once would block the first paint: the
 * collection's newest stand in and the picks replace them, row for row, once the index has been
 * built in short slices (a pointer or focus on the list holds the swap until it leaves).
 *
 * Choosing a row freezes the list as a playlist (history state): the next page shows the same rows
 * in the same order. More… (and autoplay at the end of the list) appends the next picks for the
 * video that first listed them. Those take a larger recommender run than the list itself, so they
 * are worked out only when wanted, or in idle time once More… is pointed at or focused, never
 * while the page renders.
 */
export function useUpNext(video: Video, profile: Profile): UpNextList {
  const location = useLocation()
  const navigate = useNavigate()
  const listRef = useRef<HTMLOListElement>(null)
  const [picked] = useState(profile)
  const [playlist] = useState(() => playlistIn(location.state, video.id))
  // After a refresh the rows are this video's own picks, even on a playlist page.
  const [own, setOwn] = useState(false)
  const origin = (!own && playlist && getVideo(playlist.from)) || video
  const [ready, setReady] = useState(isRecommenderReady)
  const [rows, setRows] = useState<Rows>(() =>
    playlist
      ? { items: playlistRows(without(playlist.ids, playlist.from), origin, picked), final: true }
      : isRecommenderReady()
        ? { items: upNextFor(video, picked), final: true }
        : { items: upNextPlaceholder(video), final: false },
  )
  const [pending, setPending] = useState<UpNextItem[] | null>(null)

  useEffect(() => {
    if (ready) return
    let live = true
    void warmRecommenderAsync().then(() => {
      if (!live) return
      setReady(true)
      if (!rows.final) setPending(upNextFor(video, picked))
    })
    return () => {
      live = false
    }
  }, [ready, rows.final, video, picked])

  // The picks take over from the stand-ins once neither pointer nor focus is on the list.
  useEffect(() => {
    const list = listRef.current
    if (!pending) return
    let live = true
    const swap = () => {
      if (!live || (list && (list.contains(document.activeElement) || list.matches(':hover'))))
        return
      setRows({ items: pending, final: true })
      setPending(null)
    }
    const later = () => setTimeout(swap)
    later()
    list?.addEventListener('focusout', later)
    list?.addEventListener('pointerleave', later)
    return () => {
      live = false
      list?.removeEventListener('focusout', later)
      list?.removeEventListener('pointerleave', later)
    }
  }, [pending])

  // The next picks for the rows shown, one more than More… adds: a short answer means none are
  // left after them.
  const next = useRef<{ after: UpNextItem[]; picks: UpNextItem[] } | null>(null)
  const nextPicks = (after: UpNextItem[]) => {
    if (next.current?.after !== after)
      next.current = { after, picks: moreUpNext(origin, video, after, picked, MORE + 1) }
    return next.current.picks
  }
  const [left, setLeft] = useState(true)
  const more = ready && rows.final ? left : null
  const from = (!own && playlist?.from) || video.id
  // The video the picks are for heads the list: "Now playing" on its own page.
  const shown = useMemo(() => [{ video: origin, reason: '' }, ...rows.items], [origin, rows.items])
  const asPlaylist = (items = rows.items): Playlist => ({
    from,
    ids: [origin.id, ...items.map((i) => i.video.id)],
  })

  const append = () => {
    if (!more) return []
    const picks = nextPicks(rows.items)
    const added = picks.slice(0, MORE)
    if (picks.length <= MORE) setLeft(false)
    if (!added.length) return []
    const items = [...rows.items, ...added]
    setRows({ items, final: true })
    if (playlist && !own) {
      const state = withPlaylist(location.state, asPlaylist(items))
      void navigate(location, { replace: true, state, preventScrollReset: true })
    }
    return added
  }

  // Every row shown since the page opened, so a refresh brings new ones until the picks run out.
  const seen = useRef<UpNextItem[]>([])
  const refresh = () => {
    seen.current = [...seen.current, ...rows.items]
    let picks = moreUpNext(video, video, seen.current, picked, MORE)
    if (picks.length < MORE) {
      seen.current = []
      picks = upNextFor(video, picked)
    }
    if (playlist && !own) {
      // The playlist is left behind: Back to this entry recomputes rather than restoring it.
      setOwn(true)
      const state = { ...(location.state as object), playlist: undefined }
      void navigate(location, { replace: true, state, preventScrollReset: true })
    }
    next.current = null
    setLeft(true)
    setRows({ items: picks, final: true })
  }

  const scheduled = useRef<(() => void) | undefined>(undefined)
  const prefetch = () => {
    const after = rows.items
    if (!more || next.current?.after === after || scheduled.current) return
    scheduled.current = onIdle(() => {
      scheduled.current = undefined
      nextPicks(after)
    }, 1000)
  }
  useEffect(() => () => scheduled.current?.(), [])

  return {
    items: shown,
    final: rows.final,
    more,
    playlist: own ? null : playlist,
    asPlaylist: () => asPlaylist(),
    append,
    refresh: ready && rows.final ? refresh : null,
    prefetch,
    listRef,
  }
}

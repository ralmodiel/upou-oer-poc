import { useEffect, useRef, useState, type RefObject } from 'react'
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

// Rows More… adds at a time.
const MORE = 8

/** Whether the next video plays when one ends: on unless turned off (only a stored false is off). */
export function useAutoplay() {
  const [stored, setStored] = usePersistentState<unknown>('upou:autoplay', true)
  return [stored !== false, (on: boolean) => setStored(on)] as const
}

interface Rows {
  items: UpNextItem[]
  /** The recommender's picks or a playlist (else the stand-ins shown while its index builds). */
  final: boolean
}

export interface UpNextList {
  items: UpNextItem[]
  /** Whether More… has rows to add: null while the recommender's index builds, false once none are left. */
  more: boolean | null
  /** The playlist this page was opened from (null when it computed its own list). */
  playlist: Playlist | null
  /** The list as a playlist, for links into it: `ids` as shown, `from` its origin. */
  asPlaylist: () => Playlist
  /** Adds the next picks to the end (on a playlist page, kept in history state); returns them. */
  append: () => UpNextItem[]
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
  const origin = (playlist && getVideo(playlist.from)) || video
  const [ready, setReady] = useState(isRecommenderReady)
  const [rows, setRows] = useState<Rows>(() =>
    playlist
      ? { items: playlistRows(playlist.ids, origin, picked), final: true }
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
  const from = playlist?.from ?? video.id
  const asPlaylist = (items = rows.items): Playlist => ({
    from,
    ids: items.map((i) => i.video.id),
  })

  const append = () => {
    if (!more) return []
    const picks = nextPicks(rows.items)
    const added = picks.slice(0, MORE)
    if (picks.length <= MORE) setLeft(false)
    if (!added.length) return []
    const items = [...rows.items, ...added]
    setRows({ items, final: true })
    if (playlist) {
      const state = withPlaylist(location.state, asPlaylist(items))
      void navigate(location, { replace: true, state, preventScrollReset: true })
    }
    return added
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
    items: rows.items,
    more,
    playlist,
    asPlaylist: () => asPlaylist(),
    append,
    prefetch,
    listRef,
  }
}

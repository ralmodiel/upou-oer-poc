import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { prefersReducedMotion } from '../../components/hooks'
import Thumbnail from '../../components/Thumbnail'
import Button from '../../components/ui/Button'
import SectionHeading from '../../components/ui/SectionHeading'
import { getVideo } from '../../data/catalog'
import { DEFAULT_CHANNEL } from '../../data/expand'
import { formatDate } from '../../lib/format'
import type { Profile } from '../../lib/history'
import { isRecommenderReady, warmRecommenderAsync } from '../../lib/recommend'
import type { Video } from '../../types'
import { NowPlayingIcon } from './icons'
import {
  moreUpNext,
  playlistIn,
  playlistRows,
  upNextFor,
  upNextPlaceholder,
  withPlaylist,
  type UpNextItem,
} from './recommendations'
import './watch.css'

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

interface Rows {
  items: UpNextItem[]
  /** The recommender's picks or a playlist (else the stand-ins shown while its index builds). */
  final: boolean
}

/**
 * Compact list of recommended videos in its own scroll area; each row is one link, so it is
 * keyboard operable as is (the thumbnail takes a gold frame). The reason sits above the title in
 * sentence case; without one the collection eyebrow stands in.
 *
 * Picked once per video (the watch page keys this by video) with the profile of that moment, so
 * the list is not re-ranked while watching. On a cold visit the recommender's index is not built
 * yet, and building it at once would block the first paint: the collection's newest stand in and
 * the picks replace them, row for row in rows of one fixed height, once the index has been built
 * in short slices (a pointer or focus on the list holds the swap until it leaves).
 *
 * Choosing a row freezes the list as a playlist (history state): the next page shows the same
 * rows in the same order with its own row marked "Now playing". More… appends the next picks for
 * the video that first listed them.
 */
export default function UpNext({ video, profile }: { video: Video; profile: Profile }) {
  const location = useLocation()
  const navigate = useNavigate()
  const listRef = useRef<HTMLOListElement>(null)
  const focusFrom = useRef<number | null>(null)
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

  // Arriving from a playlist: the row now playing is in view, centred when it can be.
  useLayoutEffect(() => {
    const list = listRef.current
    const row = list?.querySelector<HTMLElement>('[aria-current="true"]')
    if (list && row) list.scrollTop = row.offsetTop - (list.clientHeight - row.offsetHeight) / 2
  }, [])

  // After More…: focus on the first new row, scrolled to the top of the list.
  useEffect(() => {
    const from = focusFrom.current
    const list = listRef.current
    if (from === null || !list) return
    focusFrom.current = null
    const row = list.querySelectorAll<HTMLElement>('.watch-next')[from]
    if (!row) return
    row.focus({ preventScroll: true })
    list.scrollTo?.({ top: row.offsetTop, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [rows])

  const more = useMemo(
    () => (ready && rows.final ? moreUpNext(origin, video, rows.items, picked) : null),
    [ready, rows, origin, video, picked],
  )

  const onMore = () => {
    if (!more?.length) return
    const items = [...rows.items, ...more]
    focusFrom.current = rows.items.length
    setRows({ items, final: true })
    if (!playlist) return
    const state = withPlaylist(location.state, {
      from: playlist.from,
      ids: items.map((i) => i.video.id),
    })
    void navigate(location, { replace: true, state, preventScrollReset: true })
  }

  if (!rows.items.length) return null
  const ids = rows.items.map((i) => i.video.id)
  const linkState = withPlaylist(location.state, { from: playlist?.from ?? video.id, ids })
  // The row now playing stays where it is; choosing it again goes nowhere.
  const stay = (e: MouseEvent) => e.preventDefault()

  return (
    <section className="watch-upnext">
      <SectionHeading title="Up next" id="up-next-heading" />
      <div className="watch-upnext-frame mt-3 border-y border-line">
        <ol
          ref={listRef}
          aria-labelledby="up-next-heading"
          data-spatial="list"
          className="watch-upnext-list divide-y divide-line"
        >
          {/* Rows are keyed by position, so the picks take over the stand-ins' rows and
              thumbnails; their text is new (keyed by video), so a different line count moves no
              old text. */}
          {rows.items.map(({ video: v, reason }, i) => {
            const current = v.id === video.id
            return (
              <li key={i} className="mx-2">
                <Link
                  to={`/watch/${v.id}`}
                  state={linkState}
                  aria-current={current || undefined}
                  onClick={current ? stay : undefined}
                  className="watch-next group -mx-2 flex gap-3 rounded-card px-2 py-3 transition-colors hover:bg-surface-2"
                >
                  {/* Never a flagged frame: a video with no clean image gets its title tile. */}
                  <Thumbnail
                    video={v}
                    sizes="(min-width: 640px) 144px, 112px"
                    className="watch-next-thumb w-28 shrink-0 self-start rounded-lg ring-1 ring-black/5 sm:w-36"
                  />
                  <span key={v.id} className="watch-next-text min-w-0 self-center">
                    {current ? (
                      <span className="flex items-center gap-1.5 text-xs/snug font-semibold text-forest">
                        <NowPlayingIcon className="size-3 shrink-0" />
                        Now playing
                      </span>
                    ) : reason ? (
                      <span className="block truncate text-xs/snug font-medium text-forest">
                        {sentence(reason)}
                      </span>
                    ) : (
                      <span className="eyebrow block truncate">{v.category}</span>
                    )}
                    <span className="mt-1 line-clamp-2 text-sm/snug font-semibold text-ink group-hover:text-maroon">
                      {v.title}
                    </span>
                    <span className="mt-1 block truncate text-xs text-ink-3">
                      {[
                        formatDate(v.publishedAt),
                        reason && v.category,
                        v.channel !== DEFAULT_CHANNEL && v.channel,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </div>
      {/* Under the scroll area, so it is always in sight; gone once nothing more is left. */}
      {(more === null || more.length > 0) && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onMore}
          aria-disabled={more === null || undefined}
          className="watch-upnext-more mt-3 w-full aria-disabled:cursor-wait aria-disabled:opacity-60"
        >
          {more === null ? 'Loading…' : 'More…'}
        </Button>
      )}
    </section>
  )
}

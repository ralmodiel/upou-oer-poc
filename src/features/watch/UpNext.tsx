import { useEffect, useId, useLayoutEffect, useRef, type MouseEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { prefersReducedMotion } from '../../components/hooks'
import Thumbnail from '../../components/Thumbnail'
import Button from '../../components/ui/Button'
import SectionHeading from '../../components/ui/SectionHeading'
import { DEFAULT_CHANNEL } from '../../data/expand'
import { formatDate } from '../../lib/format'
import { lastInput } from '../../lib/pointer'
import type { Video } from '../../types'
import { NowPlayingIcon, RefreshIcon } from './icons'
import { withPlaylist } from './recommendations'
import { useAutoplay, type UpNextList } from './useUpNext'
import './watch.css'

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// The video of a row chosen by keyboard or remote: its page (a new UpNext, keyed by video) keeps
// focus on that row, now playing, rather than handing it to the stage. By video, so a choice that
// went nowhere (Ctrl+Enter opens a tab) cannot hold focus on some later page.
let keepFocusOn: string | null = null

/**
 * Compact list of recommended videos in its own scroll area, with More… under it and the Autoplay
 * switch in its header; each row is one link, so it is keyboard operable as is (the thumbnail
 * takes a gold frame). The reason sits above the title in sentence case; without one the
 * collection eyebrow stands in. On a playlist page the row now playing is marked and stays put.
 */
export default function UpNext({ video, list }: { video: Video; list: UpNextList }) {
  const location = useLocation()
  const focusFrom = useRef<number | null>(null)
  const [autoplay, setAutoplay] = useAutoplay()
  const switchId = useId()
  const { items, more, listRef } = list

  // Arriving from a playlist: the row now playing is in view, centred when it can be. Chosen by
  // keyboard or remote, it also keeps focus where the page opens with it in sight (beside the
  // player; under it on narrow screens the stage takes focus, as it does after a click).
  useLayoutEffect(() => {
    const ol = listRef.current
    const row = ol?.querySelector<HTMLElement>('[aria-current="true"]')
    if (ol && row) ol.scrollTop = row.offsetTop - (ol.clientHeight - row.offsetHeight) / 2
    // Page coordinates: the router has not scrolled the new page to the top yet.
    const inSight = row && row.getBoundingClientRect().bottom + window.scrollY <= innerHeight
    if (keepFocusOn === video.id && inSight) row.focus({ preventScroll: true })
    keepFocusOn = null
  }, [listRef, video.id])

  // After More…: focus on the first new row, scrolled to the top of the list (below its edge fade).
  useEffect(() => {
    const from = focusFrom.current
    const ol = listRef.current
    if (from === null || !ol) return
    focusFrom.current = null
    const row = ol.querySelectorAll<HTMLElement>('.watch-next')[from]
    if (!row) return
    row.focus({ preventScroll: true })
    const pad = parseFloat(getComputedStyle(ol).scrollPaddingTop) || 0
    ol.scrollTo?.({
      top: row.offsetTop - pad,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [items, more, listRef])

  // Focus moves to the first new row; with nothing left to add, More… goes and the last row takes it.
  // While the picks are still loading it does nothing.
  const onMore = () => {
    if (!more) return
    const before = items.length
    focusFrom.current = list.append().length ? before : before - 1
  }

  // New picks start at the top of the list; focus stays on the button.
  const onRefresh = () => {
    list.refresh?.()
    listRef.current?.scrollTo?.({ top: 0 })
  }

  if (!items.length) return null
  const linkState = withPlaylist(location.state, list.asPlaylist())
  // The row now playing stays where it is; choosing it again goes nowhere.
  const stay = (e: MouseEvent) => e.preventDefault()

  return (
    <section className="watch-upnext">
      {/* The actions take the rest of the row: refresh beside the title, Autoplay at the end. */}
      <SectionHeading title="Up next" id="up-next-heading" className="[&>:last-child]:flex-1">
        <span className="flex flex-1 items-center gap-2 text-sm font-medium text-ink-2">
          {list.refresh && (
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh Up next"
              title="Refresh Up next"
              className="watch-refresh group -ml-4 inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <RefreshIcon className="size-5 transition-transform duration-500 ease-out group-active:-rotate-180 motion-reduce:transition-none" />
            </button>
          )}
          {/* Names the switch; hidden itself, so screen readers do not read it twice. */}
          <span id={switchId} aria-hidden="true" className="ml-auto">
            Autoplay
          </span>
          {/* The privacy panel's switch: an outlined track off, a forest track on. */}
          <button
            type="button"
            role="switch"
            aria-checked={autoplay}
            aria-labelledby={switchId}
            onClick={() => setAutoplay(!autoplay)}
            className="group inline-flex h-10 w-14 shrink-0 cursor-pointer items-center justify-center rounded-pill"
          >
            <span
              aria-hidden="true"
              className="watch-switch-track relative h-6 w-11 rounded-pill border-2 border-ink-3 bg-surface transition-colors group-aria-checked:border-forest group-aria-checked:bg-forest motion-reduce:transition-none"
            >
              <span className="watch-switch-knob absolute top-0.5 left-0.5 size-4 rounded-full bg-ink-3 transition-[translate,background-color] group-aria-checked:translate-x-5 group-aria-checked:bg-on-accent motion-reduce:transition-none" />
            </span>
          </button>
        </span>
      </SectionHeading>
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
          {items.map(({ video: v, reason }, i) => {
            const current = v.id === video.id
            return (
              <li key={i} className="mx-2">
                <Link
                  to={`/watch/${v.id}`}
                  state={linkState}
                  aria-current={current || undefined}
                  onClick={
                    current
                      ? stay
                      : () => {
                          keepFocusOn = lastInput() === 'keyboard' ? v.id : null
                        }
                  }
                  className="watch-next group -mx-2 flex gap-3 rounded-card px-2 py-3 transition-colors hover:bg-surface-2 active:bg-surface-2"
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
                        <NowPlayingIcon className="watch-eq size-3 shrink-0" />
                        Now playing
                      </span>
                    ) : reason ? (
                      // One line, so rows keep one height; cut short on the narrowest phones, the
                      // whole reason stays in the row's name and, for pointers, its title.
                      <span
                        title={sentence(reason)}
                        className="block truncate text-xs/snug font-medium text-forest"
                      >
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
      {more !== false && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onMore}
          onPointerEnter={list.prefetch}
          onFocus={list.prefetch}
          aria-disabled={more === null || undefined}
          className="watch-upnext-more mt-3 w-full aria-disabled:cursor-wait aria-disabled:opacity-60"
        >
          {more === null ? 'Loading…' : 'More…'}
        </Button>
      )}
    </section>
  )
}

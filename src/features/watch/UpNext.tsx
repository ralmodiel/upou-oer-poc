import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { prefersReducedMotion } from '../../components/hooks'
import Thumbnail from '../../components/Thumbnail'
import Button from '../../components/ui/Button'
import SectionHeading from '../../components/ui/SectionHeading'
import { DEFAULT_CHANNEL } from '../../data/expand'
import { formatDate } from '../../lib/format'
import { lastInput } from '../../lib/pointer'
import type { Video } from '../../types'
import { RefreshIcon } from './icons'
import { withPlaylist } from './recommendations'
import { swapWatchPage } from './useStageCentre'
import { useAutoplay, type UpNextList } from './useUpNext'
import './watch.css'

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// The video of a row chosen by keyboard or remote: its page (a new UpNext, keyed by video) keeps
// focus on that row, now playing, rather than handing it to the stage. By video, so a choice that
// went nowhere (Ctrl+Enter opens a tab) cannot hold focus on some later page.
let keepFocusOn: string | null = null

// Up next lists on screen. One rendering while another is still mounted is a page change from
// inside the watch page (a row, autoplay, Back or Forward), where the list just stays as it is.
let mounted = 0

// The list's scroll as a page change made from the page took it down, for the next one.
let keptScroll: number | null = null
/** How long the list waits, unseen, for the picks before it shows the stand-ins instead. */
export const REVEAL_WAIT_MS = 1500

// How far back up the viewer scrolls before reaching the end again cues More… again.
const NUDGE_REARM_PX = 24
// The viewer's own scrolling (focus alone can come from the page: More… hands it to a row).
const VIEWER_INPUT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

// Things the viewer does in the list that end the following of the row now playing (UpNext).
const TAKE_OVER = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'focusin'] as const

/**
 * A row other than the one now playing, chosen: the page changes in one view transition
 * (swapWatchPage), unless motion is unwelcome. A click that opens a tab or window (a modifier key)
 * is left to the browser, unmarked.
 */
function choose(e: MouseEvent, id: string, go: () => void) {
  if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
  keepFocusOn = lastInput() === 'keyboard' ? id : null
  if (swapWatchPage(go)) e.preventDefault()
}

/** Whether the list scrolls on its own (beside the stage, from lg); under the stage the page does. */
const scrollsItself = (ol: HTMLElement) => getComputedStyle(ol).overflowY !== 'visible'

/**
 * Scrolls the list (never the page) so the row now playing is in view, centred when it can be:
 * at once, or gliding when smooth; with ifHidden, only when it is not wholly in view already.
 * A list that does not scroll on its own (under the stage) stays as it is. Returns that row, if
 * the list has one.
 */
function centreNowPlaying(ol: HTMLElement, smooth = false, ifHidden = false): HTMLElement | null {
  const row = ol.querySelector<HTMLElement>('[aria-current="true"]')
  if (!row) return null
  // From the boxes, not offsetTop: a row's offsetParent changes while a filter is on it.
  const box = row.getBoundingClientRect()
  const list = ol.getBoundingClientRect()
  // In view means clear of the list's edge fades (its scroll padding), not just inside its box.
  const style = getComputedStyle(ol)
  const padTop = parseFloat(style.scrollPaddingTop) || 0
  const padBottom = parseFloat(style.scrollPaddingBottom) || 0
  const above = box.top - (list.top + padTop)
  const below = box.bottom - (list.bottom - padBottom)
  if (ifHidden && above >= 0 && below <= 0) return row
  const at = box.top - list.top + ol.scrollTop
  const max = Math.max(0, ol.scrollHeight - ol.clientHeight)
  // A kept list moves only as far as it must; an arriving one centres the row.
  const want = ifHidden
    ? ol.scrollTop + (above < 0 ? above : below)
    : at - (ol.clientHeight - box.height) / 2
  const top = Math.min(max, Math.max(0, want))
  if (Math.abs(ol.scrollTop - top) < 1) return row
  if (smooth && ol.scrollTo) ol.scrollTo({ top, behavior: 'smooth' })
  else ol.scrollTop = top
  return row
}

/**
 * Compact list of recommended videos in its own scroll area, with More… under it and the Autoplay
 * switch in its header; each row is one link, so it is keyboard operable as is (the thumbnail
 * takes a gold frame). The reason sits above the title in sentence case; without one the
 * collection eyebrow stands in. On a playlist page the row now playing is marked and stays put.
 */
export default function UpNext({ video, list }: { video: Video; list: UpNextList }) {
  const location = useLocation()
  const navigate = useNavigate()
  const focusFrom = useRef<number | null>(null)
  const [autoplay, setAutoplay] = useAutoplay()
  const switchId = useId()
  const { items, more, listRef } = list
  // Unseen (its space kept) until the picks are in, so it shows once, whole, rather than swapping
  // under the eye; the stand-ins show if the picks take longer than REVEAL_WAIT_MS (watch.css).
  // Only on arriving from outside the watch page or on a whole page load (the count starts at 0
  // with the module); never for a page change made from the list, where it stays put.
  const [entrance] = useState(() => mounted === 0)
  // Only an arriving list follows the row now playing as it settles; a kept one stays as it was.
  const following = useRef(entrance)
  const [waited, setWaited] = useState(false)
  const ready = list.final || waited
  useEffect(() => {
    mounted++
    return () => {
      mounted--
    }
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), REVEAL_WAIT_MS)
    return () => clearTimeout(timer)
  }, [])

  // Arriving from a playlist: the row now playing is in view, centred when it can be. Chosen by
  // keyboard or remote, it also keeps focus where the page opens with it in sight (beside the
  // player; under it on narrow screens the stage takes focus, as it does after a click).
  // A list kept from the page before scrolls where that one was, then brings the row now playing
  // into view only if it is not in view already, so the column stays still.
  useLayoutEffect(() => {
    const ol = listRef.current
    const kept = !entrance && keptScroll !== null
    if (ol && kept) ol.scrollTop = keptScroll ?? 0
    keptScroll = null
    const row = ol ? centreNowPlaying(ol, false, kept) : null
    // Page coordinates: the router has not scrolled the new page to the top yet.
    const inSight = row && row.getBoundingClientRect().bottom + window.scrollY <= innerHeight
    if (keepFocusOn === video.id && inSight) row.focus({ preventScroll: true })
    keepFocusOn = null
    return () => {
      keptScroll = ol ? ol.scrollTop : null
    }
  }, [entrance, listRef, video.id])

  // The list's height settles after the page (from lg the aside follows the main column, which
  // grows as the citation comes in) and the picks may replace the stand-ins: the row now playing is
  // kept in view through both, until the viewer scrolls or moves in the list, or uses More… or
  // Refresh. Gliding once the rows show, unless motion is unwelcome.
  const glide = useEffectEvent(() => ready && !prefersReducedMotion())
  useEffect(() => {
    const ol = listRef.current
    if (!ol || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (following.current) centreNowPlaying(ol, glide())
    })
    const done = () => {
      observer.disconnect()
      for (const type of TAKE_OVER) ol.removeEventListener(type, stop)
    }
    const stop = () => {
      following.current = false
      done()
    }
    observer.observe(ol)
    for (const type of TAKE_OVER) ol.addEventListener(type, stop, { passive: true })
    return done
  }, [listRef])
  useEffect(() => {
    const ol = listRef.current
    if (ol && following.current) centreNowPlaying(ol, glide())
  }, [items, listRef])

  // Scrolled to the end of the list by the viewer (not by a centring or More…), More… gives one
  // cue (watch.css), again only after they have scrolled back up. Nothing while it loads or is gone.
  // Beside the stage that is the end of the list's own scroll; under it, where the page scrolls the
  // list, it is More… coming wholly into view above the tab bar.
  const [nudge, setNudge] = useState(0)
  const viewerScroll = useRef(false)
  const cue = useEffectEvent(() => {
    if (more) setNudge((n) => n + 1)
  })
  useEffect(() => {
    const ol = listRef.current
    if (!ol) return
    let armed = true
    const reached = (gap: number) => {
      if (gap > NUDGE_REARM_PX) armed = true
      else if (gap <= 2 && armed && viewerScroll.current) {
        armed = false
        cue()
      }
    }
    const viewer = () => {
      viewerScroll.current = true
    }
    const onScroll = () => reached(ol.scrollHeight - ol.clientHeight - ol.scrollTop)
    // The page's own scrolling counts only where the list does not scroll on its own.
    const pageViewer = () => {
      if (!scrollsItself(ol)) viewer()
    }
    const onPageScroll = () => {
      if (scrollsItself(ol)) return
      const html = getComputedStyle(document.documentElement)
      const end = innerHeight - (parseFloat(html.scrollPaddingBottom) || 0)
      reached((ol.closest('section') ?? ol).getBoundingClientRect().bottom - end)
    }
    for (const type of VIEWER_INPUT) {
      ol.addEventListener(type, viewer, { passive: true })
      document.addEventListener(type, pageViewer, { passive: true })
    }
    ol.addEventListener('scroll', onScroll, { passive: true })
    addEventListener('scroll', onPageScroll, { passive: true })
    return () => {
      for (const type of VIEWER_INPUT) {
        ol.removeEventListener(type, viewer)
        document.removeEventListener(type, pageViewer)
      }
      ol.removeEventListener('scroll', onScroll)
      removeEventListener('scroll', onPageScroll)
    }
  }, [listRef])

  // After More…: focus on the first new row, scrolled to the top of the list (below its edge fade);
  // under the stage, the page brings it up to just under the stage (html scroll padding).
  useEffect(() => {
    const from = focusFrom.current
    const ol = listRef.current
    if (from === null || !ol) return
    focusFrom.current = null
    const row = ol.querySelectorAll<HTMLElement>('.watch-next')[from]
    if (!row) return
    row.focus({ preventScroll: true })
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth'
    if (!scrollsItself(ol)) {
      row.scrollIntoView?.({ block: 'start', behavior })
      return
    }
    const pad = parseFloat(getComputedStyle(ol).scrollPaddingTop) || 0
    ol.scrollTo?.({ top: row.offsetTop - pad, behavior })
  }, [items, more, listRef])

  // Focus moves to the first new row; with nothing left to add, More… goes and the last row takes it.
  // While the picks are still loading it does nothing.
  const onMore = () => {
    if (!more) return
    following.current = false
    viewerScroll.current = false
    const before = items.length
    focusFrom.current = list.append().length ? before : before - 1
  }

  // New picks start at the top of the list; focus stays on the button.
  const onRefresh = () => {
    following.current = false
    viewerScroll.current = false
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
          data-entrance={entrance || undefined}
          data-ready={ready || undefined}
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
                      : (e) =>
                          choose(
                            e,
                            v.id,
                            () => void navigate(`/watch/${v.id}`, { state: linkState }),
                          )
                  }
                  className="watch-next group -mx-2 flex gap-3 rounded-card px-2 py-3 transition-colors hover:bg-surface-2 active:bg-surface-2"
                >
                  {/* Never a flagged frame: a video with no clean image gets its title tile. */}
                  <Thumbnail
                    video={v}
                    sizes="(min-width: 640px) 144px, 112px"
                    loading="eager"
                    className="watch-next-thumb w-28 shrink-0 self-start rounded-lg ring-1 ring-black/5 sm:w-36"
                  />
                  <span key={v.id} className="watch-next-text min-w-0 self-center">
                    {current ? (
                      <span className="flex items-center gap-1.5 text-xs/snug font-semibold text-forest">
                        {/* Three level bars (watch.css). */}
                        <span aria-hidden="true" className="watch-eq">
                          <span />
                          <span />
                          <span />
                        </span>
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
      {/* Under the list; gone once nothing more is left. */}
      {more !== false && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onMore}
          onPointerEnter={list.prefetch}
          onFocus={list.prefetch}
          aria-disabled={more === null || undefined}
          // Two names for one cue, so each new one restarts it (watch.css).
          data-nudge={more && nudge ? (nudge % 2 ? 'a' : 'b') : undefined}
          className="watch-upnext-more mt-3 w-full aria-disabled:cursor-wait aria-disabled:opacity-60"
        >
          {more === null ? 'Loading…' : 'More…'}
        </Button>
      )}
    </section>
  )
}

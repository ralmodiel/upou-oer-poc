// State of a home row that scrolls sideways (Carousel): `useCarousel(count)` measures the track
// (again when `count`, the number of items, changes), pages it, says when the whole row may render
// (`full`) and loads the next page's images ahead of time.
import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { onIdle } from './browse-hooks'
import { prefersReducedMotion } from './hooks'

/** Items a row renders at first: its first page and the card peeking after it. */
export const FIRST_ITEMS = 5

interface RowState {
  /** At the first card, at the last one: the button that way hides. */
  start: boolean
  end: boolean
  page: number
  pages: number
  /** First card in view after the last scroll made while focus was elsewhere (the Tab stop). */
  first: number
}

const INITIAL: RowState = { start: true, end: true, page: 0, pages: 1, first: 0 }

const SMOOTH_MS = 700

const px = (value: string) => parseFloat(value) || 0

/** Card pitch, page width (every card wholly in view) and scroll range of a track. */
function geometry(track: HTMLElement) {
  const list = track.firstElementChild
  const items = list?.children ?? []
  const style = getComputedStyle(track)
  const view = track.clientWidth - px(style.paddingLeft) - px(style.paddingRight)
  const gap = list ? px(getComputedStyle(list).columnGap) : 0
  const pitch =
    items.length > 1
      ? items[1].getBoundingClientRect().left - items[0].getBoundingClientRect().left
      : 0
  // The view holds n cards and n - 1 gaps; a page moves on by all n.
  const page = pitch > 0 ? Math.max(1, Math.floor((view + gap + 1) / pitch)) * pitch : view + gap
  return { pitch, page: Math.max(1, page), max: track.scrollWidth - track.clientWidth }
}

// Lazy images clipped by the track load only once scrolled in, so paging would show them fading in
// over their wells: those up to a page past the view load now (row hovered or focused, scrolled).
function warm(track: HTMLElement) {
  const { pitch, page } = geometry(track)
  const reach = track.scrollLeft + track.clientWidth + page
  const items = track.firstElementChild?.children ?? []
  for (let i = 0; i < items.length && i * pitch < reach; i++) {
    const img = items[i].querySelector<HTMLImageElement>('img[loading="lazy"]')
    if (img) img.loading = 'eager'
  }
}

const same = (a: RowState, b: RowState) =>
  a.start === b.start &&
  a.end === b.end &&
  a.page === b.page &&
  a.pages === b.pages &&
  a.first === b.first

export function useCarousel(count: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState(INITIAL)
  // Where the last button press is taking the track, so a quick second press pages on from there.
  const aim = useRef({ to: 0, at: -Infinity })
  // The rest of the row renders once it is used (hovered, focused, touched) or the browser is idle,
  // so a page of rows near the viewport does not render all their cards in one go.
  const [full, setFull] = useState(false)
  const used = useRef(false)

  useEffect(() => {
    if (full || !count) return
    return onIdle(() => startTransition(() => setFull(true)))
  }, [full, count])

  const measure = useCallback(() => {
    const track = ref.current
    if (!track) return
    const { pitch, page, max } = geometry(track)
    const x = track.scrollLeft
    const end = x >= max - 1
    const pages = max > 1 ? Math.ceil((max - 1) / page) + 1 : 1
    const focused = track.contains(document.activeElement)
    setState((s) => {
      const next = {
        start: x <= 1,
        end,
        pages,
        page: end ? pages - 1 : Math.min(pages - 1, Math.round(x / page)),
        first: focused || !pitch ? s.first : Math.round(x / pitch),
      }
      return same(s, next) ? s : next
    })
  }, [])

  // A row put to use before the rest of it rendered loads its next page once it has.
  useEffect(() => {
    if (full && used.current && ref.current) warm(ref.current)
  }, [full])

  // Measured on the frame after layout, never forcing one while React commits: once the track
  // mounts with its items (`count`; a skeleton row has none), when they change, on resize and scroll.
  useEffect(() => {
    const track = ref.current
    if (!track) return
    let frame = 0
    let scrolled = false
    const schedule = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0
          measure()
          // Only a track on the move loads ahead (a resize, the first one included, does not).
          if (scrolled) warm(track)
          scrolled = false
        })
    }
    const onScroll = () => {
      scrolled = true
      schedule()
    }
    schedule()
    track.addEventListener('scroll', onScroll, { passive: true })
    const resize = new ResizeObserver(schedule)
    resize.observe(track)
    return () => {
      cancelAnimationFrame(frame)
      track.removeEventListener('scroll', onScroll)
      resize.disconnect()
    }
  }, [measure, count, full])

  /** The row is in use: render all of it and load its next page. */
  const engage = useCallback(() => {
    used.current = true
    setFull(true)
    if (ref.current) warm(ref.current)
  }, [])

  /** Pages by every card in view; a button about to hide hands its focus to the new page. */
  const step = useCallback((dir: 1 | -1, button: HTMLElement) => {
    const track = ref.current
    if (!track) return
    const { pitch, page, max } = geometry(track)
    // Still on the way to the last press's page: page on from there.
    const onTheWay =
      performance.now() - aim.current.at < SMOOTH_MS &&
      Math.abs(aim.current.to - track.scrollLeft) < page
    const from = onTheWay ? aim.current.to : track.scrollLeft
    const to = Math.min(max, Math.max(0, from + dir * page))
    aim.current = { to, at: performance.now() }
    track.scrollBy({
      left: to - track.scrollLeft,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
    if (document.activeElement !== button || (dir > 0 ? to < max - 1 : to > 1)) return
    const item = track.firstElementChild?.children[pitch > 0 ? Math.round(to / pitch) : 0]
    item?.querySelector<HTMLElement>('[data-card-link], a[href]')?.focus({ preventScroll: true })
  }, [])

  return { ref, ...state, full, engage, step }
}

export type CarouselState = ReturnType<typeof useCarousel>

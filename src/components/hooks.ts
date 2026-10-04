import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
} from 'react'
import { useLocation, useNavigationType } from 'react-router'

export { useMediaQuery } from './browse-hooks'

// Where to come back to on each page of this visit, by location key: the control the page was left
// from (a card, its Details link, a chip, or the last control focused in it before the search
// field), found again by its row and place there, never by its video alone: Recently viewed may
// hold a copy, and a home row moves on once a video it showed has been watched.
interface Spot {
  /** The home row ([data-row] list) holding it, its item there and which control in the item. */
  row: string | null
  item: number
  nth: number
  /** Tag and link (or label): the same control again, in its row or outside the rows. */
  sig: string
  /** The page's entry control (the hero's Play), which a new slide may have changed. */
  entry: boolean
  /** Its card's top on screen and the page's scroll position then; its row's scroll position. */
  top: number
  y: number
  x: number
}

const CONTROLS = 'a[href], button, input, select, textarea'
const spots = new Map<string, Spot>()
// The spot noted on the page being left (the last click, key or submit there), its location key,
// and the last control focused in the page itself.
let leaving: { key: string; spot: Spot } | null = null
let lastInMain: HTMLElement | null = null
let shownKey: string | null = null
// Settling a return stops at the first input, or after this long (late rows: recommendations).
const SETTLE_MS = 3000

const signatureOf = (el: Element) =>
  `${el.tagName}|${el.getAttribute('href') ?? el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 60)}`
const shapeOf = (el: HTMLElement) =>
  el.hasAttribute('data-card-link') ? (el.closest('article') ?? el) : el

function spotOf(el: HTMLElement): Spot {
  const row = el.closest<HTMLElement>('[data-row]')
  const item = row ? Array.from(row.children).findIndex((li) => li.contains(el)) : -1
  const own = item >= 0 ? Array.from(row!.children[item].querySelectorAll(CONTROLS)) : []
  return {
    row: row?.dataset.row ?? null,
    item,
    nth: own.indexOf(el),
    sig: signatureOf(el),
    entry: el.matches('[data-spatial="entry"]'),
    top: shapeOf(el).getBoundingClientRect().top,
    y: window.scrollY,
    x: el.closest('[data-spatial="track"]')?.scrollLeft ?? 0,
  }
}

function findSpot(spot: Spot): HTMLElement | null {
  const main = document.querySelector('main')
  if (!main) return null
  if (spot.row === null) {
    const outside = Array.from(main.querySelectorAll<HTMLElement>(CONTROLS)).filter(
      (el) => !el.closest('[data-row], [aria-hidden="true"]'),
    )
    const same = outside.find((el) => signatureOf(el) === spot.sig)
    return same ?? (spot.entry ? main.querySelector<HTMLElement>('[data-spatial="entry"]') : null)
  }
  const row = Array.from(main.querySelectorAll<HTMLElement>('[data-row]')).find(
    (el) => el.dataset.row === spot.row,
  )
  if (!row) return null
  // The same control if the row still holds it, else the one now in its place.
  const same = Array.from(row.querySelectorAll<HTMLElement>(CONTROLS)).find(
    (el) => signatureOf(el) === spot.sig,
  )
  if (same) return same
  const item = row.children[Math.min(spot.item, row.children.length - 1)]
  const own = item ? Array.from(item.querySelectorAll<HTMLElement>(CONTROLS)) : []
  return own[spot.nth] ?? own[0] ?? null
}

/** On a return (Back, Forward) to this page, the home row ([data-row]) it comes back to, if any. */
export function useReturnRow(): string | null {
  const { key } = useLocation()
  const popped = useNavigationType() === 'POP'
  return popped ? (spots.get(key)?.row ?? null) : null
}

/**
 * Back to a page (from the player, after a chain of videos or a search, or a quick look reopened by
 * Back) returns focus to the control it was left from, in the same row and place, with its row
 * scrolled as it was and its card where it was on screen, whatever was added above it since (the
 * new Recently viewed). The next arrow key continues from there. Mounted once (AppLayout).
 */
export function useReturnFocus() {
  const { key } = useLocation()
  const popped = useNavigationType() === 'POP'

  useEffect(() => {
    const note = (e: Event) => {
      const target = e.target instanceof Element ? e.target : null
      const control = target?.closest<HTMLElement>(CONTROLS)
      const el = control?.closest('main') ? control : lastInMain?.isConnected ? lastInMain : null
      leaving = el ? { key, spot: spotOf(el) } : null
    }
    const onFocus = (e: Event) => {
      if (e.target instanceof HTMLElement && e.target.closest('main')) lastInMain = e.target
    }
    document.addEventListener('click', note, true)
    document.addEventListener('keydown', note, true)
    document.addEventListener('submit', note, true)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('click', note, true)
      document.removeEventListener('keydown', note, true)
      document.removeEventListener('submit', note, true)
      document.removeEventListener('focusin', onFocus)
    }
  }, [key])

  useEffect(() => {
    // The page just left keeps the spot noted there; one left without a note forgets its old one.
    if (shownKey !== null && shownKey !== key) {
      if (leaving?.key === shownKey) spots.set(shownKey, leaving.spot)
      else spots.delete(shownKey)
    }
    shownKey = key
    leaving = null
    const spot = popped ? spots.get(key) : undefined
    const main = document.querySelector('main')
    if (!spot || !main) return
    // Where its card sat on screen when the page was left (the router has restored that scroll
    // position); a spot that was off screen by then is left alone.
    const want = spot.top + spot.y - window.scrollY
    if (want < 0 || want > window.innerHeight - 40) return
    const root = document.documentElement
    // Rows render and the new Recently viewed lands over the next frames: put the control back
    // after each change (this, not the browser's scroll anchoring, holds the view meanwhile).
    const settle = () => {
      // A quick look reopened by Back keeps its own focus.
      if (document.activeElement?.closest('dialog[open]')) return stop()
      const el = findSpot(spot)
      if (!el) return
      const track = el.closest('[data-spatial="track"]')
      if (track && Math.abs(track.scrollLeft - spot.x) > 1) track.scrollLeft = spot.x
      const dy = shapeOf(el).getBoundingClientRect().top - want
      if (Math.abs(dy) > 1) window.scrollBy({ top: dy, behavior: 'instant' })
      if (document.activeElement !== el) el.focus({ preventScroll: true })
    }
    const observer = new MutationObserver(settle)
    const frame = requestAnimationFrame(settle)
    const timer = window.setTimeout(() => stop(), SETTLE_MS)
    const inputs = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const
    function stop() {
      observer.disconnect()
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      for (const type of inputs) window.removeEventListener(type, stop, true)
      root.style.removeProperty('overflow-anchor')
    }
    observer.observe(main, { childList: true, subtree: true })
    for (const type of inputs) window.addEventListener(type, stop, { capture: true, passive: true })
    root.style.setProperty('overflow-anchor', 'none')
    return stop
  }, [key, popped])
}

/** Sets document.title while mounted and restores the previous title afterwards. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}

function subscribeScroll(onChange: () => void) {
  let frame = 0
  const onScroll = () => {
    frame ||= requestAnimationFrame(() => {
      frame = 0
      onChange()
    })
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('scroll', onScroll)
  }
}

/** True once the page is scrolled past `threshold`; re-renders only when that flips. */
export function useScrolledPast(threshold: number) {
  return useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > threshold,
    () => false,
  )
}

/**
 * Roving tabindex for a <ul> of chips: one item in the Tab order (`tabIndexOf(i)`); Home and End
 * jump to the ends, the arrow keys are spatial navigation's (lib/spatial.ts) and any focus inside
 * the row (by key or pointer) becomes its entry point. `count` clamps that entry point when the
 * list shrinks.
 */
export function useRovingRow(count: number, initial = 0) {
  const [current, setCurrent] = useState(initial)
  const active = Math.max(0, Math.min(current, count - 1))

  const itemIndex = (list: HTMLElement, target: EventTarget) => {
    const item = (target as HTMLElement).closest('li')
    return item?.parentElement === list ? Array.prototype.indexOf.call(list.children, item) : -1
  }

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if ((e.key !== 'Home' && e.key !== 'End') || e.altKey || e.ctrlKey || e.metaKey) return
    const from = itemIndex(e.currentTarget, e.target)
    if (from < 0) return
    const last = e.currentTarget.children.length - 1
    const to = e.key === 'Home' ? 0 : last
    if (to === from) return
    e.preventDefault()
    e.currentTarget.children[to].querySelector<HTMLElement>('a, button')?.focus()
  }

  const onFocus = (e: FocusEvent<HTMLUListElement>) => {
    const index = itemIndex(e.currentTarget, e.target)
    if (index >= 0 && index !== active) setCurrent(index)
  }

  return { listProps: { onKeyDown, onFocus }, tabIndexOf: (i: number) => (i === active ? 0 : -1) }
}

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

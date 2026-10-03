// Spatial (TV-remote style) focus navigation: the arrow keys move focus to the nearest focusable
// element in that direction, anywhere on the page. Mount `useSpatialNavigation()` once (AppLayout).
//
// Candidates: links, buttons, fields and [tabindex] elements, including roving-tabindex items
// (tabindex="-1" on a link or button), minus anything aria-hidden, inert, hidden, disabled,
// zero-size or marked data-spatial="skip"; plain containers with tabindex="-1" are not stops.
// data-spatial="wide" gives a centred control the shape of its full-width row.
// While a <dialog> is open only its contents count. A card's stretched link ([data-card-link])
// stands for its whole <article>, so a grid moves card by card; inside a card its own controls
// (Save, Details) come first. Pinned bars (sticky header, tab bar) are targets only when nothing
// in the page lies that way. Text fields keep ← / → until the caret reaches the edge of their
// text; ↑ / ↓ always leave them.
import { useEffect } from 'react'
import { isEditable } from './shortcuts'

export type Direction = 'up' | 'down' | 'left' | 'right'

export const DIRECTION_OF_KEY: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

export interface Box {
  top: number
  right: number
  bottom: number
  left: number
}

const SELECTOR = 'a[href], button, input, select, textarea, [tabindex]'
const INTERACTIVE = 'a[href], button, input, select, textarea'
const HIDDEN = '[aria-hidden="true"], [inert], [hidden], [data-spatial="skip"]'
// Widgets whose arrow keys mean something natively.
const OWNS_ARROWS =
  'select, input[type="range"], input[type="number"], input[type="radio"], input[type="date"], input[type="time"], input[type="datetime-local"], input[type="month"], input[type="week"], [role="slider"], [role="listbox"], [role="menu"], [role="menubar"], [role="radiogroup"], [role="tablist"], [role="tree"], [role="grid"], [role="combobox"], audio, video'

export const isCandidate = (el: Element): boolean =>
  el instanceof HTMLElement &&
  !el.matches(':disabled') &&
  !el.closest(HIDDEN) &&
  (el.tabIndex >= 0 || el.matches(INTERACTIVE))

/** Focusable elements under `root` that spatial navigation may land on. */
export const candidates = (root: ParentNode = document): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter((el) => isCandidate(el))

const toBox = (r: DOMRect): Box => ({ top: r.top, right: r.right, bottom: r.bottom, left: r.left })

/** Geometry used for `el`: the whole card for a card link, otherwise its own rect. */
export function boxOf(el: HTMLElement): Box {
  // A centred row control (Load more) stands for its full-width row, so a move straight down
  // any column of a grid reaches it before the footer.
  const shape = el.hasAttribute('data-card-link')
    ? (el.closest('article') ?? el)
    : el.dataset.spatial === 'wide'
      ? (el.parentElement ?? el)
      : el
  return toBox(shape.getBoundingClientRect())
}

// Rotates a box so that `dir` reads as "down": near/far run along the direction of travel,
// lo/hi across it.
function project(b: Box, dir: Direction) {
  switch (dir) {
    case 'down':
      return { near: b.top, far: b.bottom, lo: b.left, hi: b.right }
    case 'up':
      return { near: -b.bottom, far: -b.top, lo: b.left, hi: b.right }
    case 'right':
      return { near: b.left, far: b.right, lo: b.top, hi: b.bottom }
    case 'left':
      return { near: -b.right, far: -b.left, lo: b.top, hi: b.bottom }
  }
}

/**
 * Cost of moving from `from` to `to` in `dir`; null when `to` does not lie in that direction.
 * Distance along the axis counts once, the gap across it twice (overlapping candidates have none)
 * and the centre offset breaks ties among aligned candidates. `loose` only asks that the centre of
 * `to` lies beyond the centre of `from` (a pinned bar while the start is scrolled partly under it).
 */
export function distance(from: Box, to: Box, dir: Direction, loose = false): number | null {
  const s = project(from, dir)
  const c = project(to, dir)
  if (loose ? c.near + c.far <= s.near + s.far : c.near < s.far - 1) return null
  const along = Math.max(0, c.near - s.far)
  const across = Math.max(0, c.lo - s.hi, s.lo - c.hi)
  const centre = Math.abs((c.lo + c.hi) / 2 - (s.lo + s.hi) / 2)
  return along + 2 * across + centre / 2
}

/** The candidate with the lowest `distance` from `from`, or undefined. */
export function nearest<T>(
  from: Box,
  items: readonly T[],
  dir: Direction,
  boxFor: (item: T) => Box,
  loose = false,
): T | undefined {
  let best: T | undefined
  let bestCost = Infinity
  for (const item of items) {
    const cost = distance(from, boxFor(item), dir, loose)
    if (cost !== null && cost < bestCost) {
      best = item
      bestCost = cost
    }
  }
  return best
}

// Where a move starts when nothing (or only a container) has focus: the corner of `b` opposite to
// `dir`, so "down" from a container finds the first row inside it, "up" the last.
function entryPoint(b: Box, dir: Direction): Box {
  const top = dir === 'up' ? b.bottom : b.top
  const left = dir === 'left' ? b.right : b.left
  return { top, bottom: top, left, right: left }
}

const viewportBox = (): Box => ({ top: 0, left: 0, bottom: innerHeight, right: innerWidth })

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

// Sticky header and fixed tab bar ("bars"): on screen whatever the scroll position. From a bar,
// its own items come first, then whatever is on screen; from the page, bars count only when
// nothing else lies that way, so ↑ from a scrolled grid reaches the chips above it, not the
// header covering them. The walk stops at `root`: an open dialog is fixed itself but scrolls its
// own content. One memo per move: candidates share most ancestors.
function barFinder(root: Element | null) {
  const memo = new Map<Element, Element | null>()
  const barOf = (el: Element): Element | null => {
    if (el === root || el === document.body || el === document.documentElement) return null
    let bar = memo.get(el)
    if (bar === undefined) {
      const position = getComputedStyle(el).position
      bar =
        position === 'fixed' || position === 'sticky'
          ? el
          : el.parentElement
            ? barOf(el.parentElement)
            : null
      memo.set(el, bar)
    }
    return bar
  }
  return barOf
}

const rectOf = (el: Element) => toBox(el.getBoundingClientRect())
// Visually hidden (sr-only) elements are a pixel large.
const visible = (b: Box) => b.right - b.left >= 2 && b.bottom - b.top >= 2

const openDialog = () => {
  const dialogs = document.querySelectorAll('dialog[open]')
  return dialogs.length ? dialogs[dialogs.length - 1] : null
}

// Caret (no selection) at the edge of a field's text, so ← / → has nothing left to do inside.
function caretAtEdge(el: Element, dir: 'left' | 'right'): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false
  let start: number | null
  let end: number | null
  try {
    start = el.selectionStart
    end = el.selectionEnd
  } catch {
    return false
  }
  if (start === null || end === null || start !== end) return false
  return dir === 'left' ? start === 0 : end === el.value.length
}

/**
 * True when `target` keeps the arrow key for itself: native widgets keep all four; a text field
 * keeps ← / → while the caret can still move (↑ / ↓ always leave it).
 */
export function keepsArrow(target: EventTarget | null, dir: Direction): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest(OWNS_ARROWS)) return true
  if (!isEditable(target) || dir === 'up' || dir === 'down') return false
  return !caretAtEdge(target, dir)
}

/**
 * The element focus should move to for `dir`, or null when nothing lies that way. Inside a card
 * its own controls come first (↓ from the title reaches Save and Details, ↑ from them the title);
 * beyond it the page moves card by card.
 */
export function findTarget(dir: Direction, from: Element | null = document.activeElement) {
  const dialog = openDialog()
  const root: ParentNode = dialog ?? document
  const start =
    from instanceof HTMLElement && from !== document.body && root.contains(from) ? from : null
  const article = start && isCandidate(start) ? start.closest('article') : null
  // Only a card (an article with a stretched link) is one unit; other articles are plain content.
  const home = article?.querySelector('[data-card-link]') ? article : null
  if (start && home) {
    const inside = candidates(home)
      .filter((el) => el !== start)
      .map((el) => ({ el, box: rectOf(el) }))
      .filter((m) => visible(m.box))
    const own = nearest(rectOf(start), inside, dir, (m) => m.box)
    if (own) return own.el
  }

  const pool = candidates(root).filter((el) => el !== start && !home?.contains(el))
  const fromBox = start
    ? isCandidate(start)
      ? home
        ? rectOf(home)
        : boxOf(start)
      : entryPoint(rectOf(start), dir)
    : entryPoint(viewportBox(), dir)
  const barOf = barFinder(dialog)
  const startBar = start ? barOf(start) : null
  const onScreenOnly = start ? startBar !== null : true
  const viewport = viewportBox()

  // From a bar: `first` holds that bar's items. From the page: the page, with bars in `last`.
  const first: { el: HTMLElement; box: Box }[] = []
  const last: { el: HTMLElement; box: Box }[] = []
  for (const el of pool) {
    const box = boxOf(el)
    if (!visible(box)) continue
    if (onScreenOnly && !overlaps(box, viewport)) continue
    const bar = barOf(el)
    if (startBar ? bar === startBar : !bar) first.push({ el, box })
    else last.push({ el, box })
  }
  const boxFor = (m: { box: Box }) => m.box
  // Bars sit above and below the page: there, the start may still be scrolling out from under one.
  const loose = !startBar && (dir === 'up' || dir === 'down')
  return (
    (nearest(fromBox, first, dir, boxFor) ?? nearest(fromBox, last, dir, boxFor, loose))?.el ?? null
  )
}

/**
 * Focuses `target` and scrolls it into view (cards to the centre); false when focus refused.
 * `instant` skips the smooth scroll (a held key repeats faster than it would finish).
 */
export function focusAndReveal(target: HTMLElement, instant = false): boolean {
  target.focus({ preventScroll: true })
  if (document.activeElement !== target) return false
  if (typeof target.scrollIntoView === 'function') {
    const smooth = !instant && !matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({
      block: target.hasAttribute('data-card-link') ? 'center' : 'nearest',
      inline: 'nearest',
      behavior: smooth ? 'smooth' : 'auto',
    })
  }
  return true
}

/** Moves focus in `dir` and scrolls the target into view; false when nothing lies that way. */
export function moveFocus(dir: Direction, instant = false): boolean {
  const target = findTarget(dir)
  return target ? focusAndReveal(target, instant) : false
}

const firstIn = (root: ParentNode) => candidates(root).find((el) => visible(rectOf(el))) ?? null

/**
 * PageDown / PageUp target: the first card (or control) of the section after / before the one
 * holding `from`; with nothing focused, the first section below the top of the screen (or the
 * last one above it). Null at the ends.
 */
export function findSection(step: 1 | -1, from: Element | null = document.activeElement) {
  const root: ParentNode = openDialog() ?? document
  const sections = Array.from(root.querySelectorAll<HTMLElement>('main section, dialog section'))
    .filter((s) => firstIn(s))
    // Nested sections count once, by their innermost holder of focus below.
    .filter((s, _, all) => !all.some((o) => o !== s && s.contains(o) && o.contains(from!)))
  const current = from ? sections.findIndex((s) => s.contains(from)) : -1
  let index: number
  if (current >= 0) index = current + step
  else {
    const below = sections.findIndex((s) => s.getBoundingClientRect().top >= 0)
    index =
      step > 0 ? (below < 0 ? sections.length : below) : below < 0 ? sections.length - 1 : below - 1
  }
  const section = sections[index]
  if (!section) return null
  return section.querySelector<HTMLElement>('[data-card-link]') ?? firstIn(section)
}

/**
 * Window keydown listener: arrows move spatially, PageUp / PageDown jump between sections, Enter
 * on a focused container (a panel, the player stage) enters its first control. Events with
 * defaultPrevented are left alone.
 */
export function useSpatialNavigation() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const dir = DIRECTION_OF_KEY[e.key]
      if (dir) {
        if (keepsArrow(e.target, dir)) return
        if (moveFocus(dir, e.repeat)) e.preventDefault()
      } else if (e.key === 'PageDown' || e.key === 'PageUp') {
        if (isEditable(e.target) || openDialog()?.hasAttribute('data-sheet')) return
        const target = findSection(e.key === 'PageDown' ? 1 : -1)
        if (target && focusAndReveal(target)) e.preventDefault()
      } else if (e.key === 'Enter') {
        const el = document.activeElement
        if (!(el instanceof HTMLElement) || el === document.body || isCandidate(el)) return
        if (isEditable(el) || el.closest(OWNS_ARROWS)) return
        const first = firstIn(el)
        if (first && focusAndReveal(first)) e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

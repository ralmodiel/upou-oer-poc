// Spatial (TV-remote style) focus navigation: the arrow keys move focus to the nearest focusable
// element in that direction, anywhere on the page. Mount `useSpatialNavigation()` once (AppLayout).
//
// Candidates: links, buttons, fields and [tabindex] elements, including roving-tabindex items
// (tabindex="-1" on a link or button), minus anything aria-hidden, inert, hidden, disabled,
// zero-size or marked data-spatial="skip"; plain containers with tabindex="-1" are not stops.
// While a <dialog> is open only its contents count. A card's stretched link ([data-card-link])
// stands for its whole <article>, so a grid moves card by card. Text fields keep ← / → until the
// caret reaches the edge of their text; ↑ / ↓ always leave them.
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
  const shape = el.hasAttribute('data-card-link') ? (el.closest('article') ?? el) : el
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
 * and the centre offset breaks ties among aligned candidates.
 */
export function distance(from: Box, to: Box, dir: Direction): number | null {
  const s = project(from, dir)
  const c = project(to, dir)
  if (c.near < s.far - 1) return null
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
): T | undefined {
  let best: T | undefined
  let bestCost = Infinity
  for (const item of items) {
    const cost = distance(from, boxFor(item), dir)
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

// Sticky header and fixed tab bar: from there, only what is on screen is a sensible target.
function isPinned(el: Element): boolean {
  for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
    const position = getComputedStyle(node).position
    if (position === 'fixed' || position === 'sticky') return true
  }
  return false
}

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

/** The element focus should move to for `dir`, or null when nothing lies that way. */
export function findTarget(dir: Direction, from: Element | null = document.activeElement) {
  const dialog = openDialog()
  const root: ParentNode = dialog ?? document
  const start =
    from instanceof HTMLElement && from !== document.body && root.contains(from) ? from : null
  const pool = candidates(root).filter((el) => el !== start)
  const fromBox = start
    ? isCandidate(start)
      ? boxOf(start)
      : entryPoint(toBox(start.getBoundingClientRect()), dir)
    : entryPoint(viewportBox(), dir)
  const onScreenOnly = start ? isPinned(start) : true
  const viewport = viewportBox()

  const measured: { el: HTMLElement; box: Box }[] = []
  for (const el of pool) {
    const box = boxOf(el)
    // Visually hidden (sr-only) elements are a pixel large.
    if (box.right - box.left < 2 || box.bottom - box.top < 2) continue
    if (onScreenOnly && !overlaps(box, viewport)) continue
    measured.push({ el, box })
  }
  return nearest(fromBox, measured, dir, (m) => m.box)?.el ?? null
}

/** Moves focus in `dir` and scrolls the target into view; false when nothing lies that way. */
export function moveFocus(dir: Direction): boolean {
  const target = findTarget(dir)
  if (!target) return false
  target.focus({ preventScroll: true })
  if (document.activeElement !== target) return false
  if (typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({
      block: target.hasAttribute('data-card-link') ? 'center' : 'nearest',
      inline: 'nearest',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }
  return true
}

/** Window keydown listener for the arrow keys; events with defaultPrevented are left alone. */
export function useSpatialNavigation() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const dir = DIRECTION_OF_KEY[e.key]
      if (!dir || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (keepsArrow(e.target, dir)) return
      if (moveFocus(dir)) e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

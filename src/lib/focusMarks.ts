import { lastInput } from './pointer'

// The boxes around keyboard focus get data-focus-mark, for the styles that show it (browse.css,
// pages.css, VideoCard): a card around its focused link, a collection tile around its link, the
// hero row's item around anything. As :has(:focus-visible) each of those rules made every focus
// move, image load and preview restyle the whole page (about 1,500 elements, ~115 ms a key press on
// a TV-class CPU).
const BOXES: readonly [string, (el: Element) => boolean][] = [
  ['.card-lift', (el) => el.hasAttribute('data-card-link')],
  ['.group\\/card', (el) => el.hasAttribute('data-card-link')],
  ['.group\\/item', (el) => el.hasAttribute('data-card-link')],
  ['.tv-card', (el) => el.tagName === 'A'],
  ['[data-row="featured"] > li', () => true],
]

const MARK = 'data-focus-mark'
let marked: Element[] = []

const clear = () => {
  for (const box of marked) box.removeAttribute(MARK)
  marked = []
}

function focusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible')
  } catch {
    // Engines without :focus-visible: focus that came from a key.
    return lastInput() === 'keyboard'
  }
}

function onFocusIn(e: FocusEvent) {
  clear()
  const el = e.target
  if (!(el instanceof Element) || !focusVisible(el)) return
  for (const [selector, takes] of BOXES) {
    const box = takes(el) ? el.closest(selector) : null
    if (box && !marked.includes(box)) {
      box.setAttribute(MARK, '')
      marked.push(box)
    }
  }
}

// Focus going to another element is handled by its focusin; this is focus leaving for nowhere.
const onFocusOut = (e: FocusEvent) => {
  if (!e.relatedTarget) clear()
}

/** Starts marking (AppLayout); returns the stop. */
export function installFocusMarks(): () => void {
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  return () => {
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('focusout', onFocusOut)
    clear()
  }
}

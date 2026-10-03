import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
} from 'react'
import { useLocation, useNavigationType } from 'react-router'

export { useMediaQuery } from './browse-hooks'

// The player or quick-look link last activated on each page of this visit, by location key.
const openedFrom = new Map<string, string>()

/**
 * Back from the player (or from a quick look reopened by Back) returns focus to the card link,
 * Play button or Details link that opened it, so the next arrow key continues from there instead
 * of the top of the page. Mounted once (AppLayout).
 */
export function useReturnFocus() {
  const { key } = useLocation()
  const popped = useNavigationType() === 'POP'

  useEffect(() => {
    const remember = (e: Event) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="/watch/"], a[href*="v="]')
      if (link) openedFrom.set(key, link.getAttribute('href') ?? '')
    }
    document.addEventListener('click', remember, true)
    return () => document.removeEventListener('click', remember, true)
  }, [key])

  useEffect(() => {
    const href = popped ? openedFrom.get(key) : undefined
    if (!href) return
    // After the page has rendered. A reopened dialog that took focus wins; focus left on the body
    // or on the shell (header, footer) belongs to the page we came back from.
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement
      if (active?.closest('dialog[open]') || active?.closest('main')) return
      const links = Array.from(document.querySelectorAll<HTMLElement>('a[href]')).filter(
        (el) => el.getAttribute('href') === href && !el.closest('[aria-hidden="true"]'),
      )
      const link = links.find((el) => el.hasAttribute('data-card-link')) ?? links[0]
      link?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
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

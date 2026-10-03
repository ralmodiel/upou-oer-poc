import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
} from 'react'

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

const ROW_MOVES: Record<string, 'next' | 'prev' | 'first' | 'last'> = {
  ArrowRight: 'next',
  ArrowLeft: 'prev',
  Home: 'first',
  End: 'last',
}

/**
 * Roving tabindex for a <ul> of chips: one item in the Tab order (`tabIndexOf(i)`), Left/Right,
 * Home and End move between items. `count` clamps the entry point when the list shrinks.
 */
export function useRovingRow(count: number, initial = 0) {
  const [current, setCurrent] = useState(initial)
  const active = Math.max(0, Math.min(current, count - 1))

  const itemIndex = (list: HTMLElement, target: EventTarget) => {
    const item = (target as HTMLElement).closest('li')
    return item?.parentElement === list ? Array.prototype.indexOf.call(list.children, item) : -1
  }

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const move = ROW_MOVES[e.key]
    if (!move || e.altKey || e.ctrlKey || e.metaKey) return
    const from = itemIndex(e.currentTarget, e.target)
    if (from < 0) return
    const last = e.currentTarget.children.length - 1
    const to = { next: from + 1, prev: from - 1, first: 0, last }[move]
    if (to === from || to < 0 || to > last) return
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

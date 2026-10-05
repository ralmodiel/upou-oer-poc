import { startTransition, useEffect, useRef, useState, useSyncExternalStore } from 'react'

const lists = new Map<string, MediaQueryList>()
const listOf = (query: string) => {
  let list = lists.get(query)
  if (!list) {
    list = window.matchMedia(query)
    lists.set(query, list)
  }
  return list
}

/** True while `query` matches; re-renders only when that flips. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = listOf(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => listOf(query).matches,
    () => false,
  )
}

export const canHover = () => window.matchMedia('(hover: hover)').matches

/** `value` as it was when `key` last changed: a snapshot that ignores later updates. */
export function useFrozen<T>(value: T, key: unknown): T {
  const [frozen, setFrozen] = useState({ key, value })
  if (frozen.key !== key) {
    setFrozen({ key, value })
    return value
  }
  return frozen.value
}

/** Runs `fn` when the browser is idle (soon after paint where idle callbacks are missing). */
export function onIdle(fn: () => void, timeout = 2000): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fn, { timeout })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(fn, 150)
  return () => clearTimeout(id)
}

/**
 * [ref, near]: near turns true, and stays true, once the element comes within `margin` of the
 * viewport (an IntersectionObserver rootMargin); `eager` starts it true.
 */
export function useNear<T extends Element>(eager: boolean, margin: string) {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(eager)
  useEffect(() => {
    const el = ref.current
    if (near || !el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) startTransition(() => setNear(true))
      },
      { rootMargin: margin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [near, margin])
  return [ref, near] as const
}

// Images below the first screen: on a first visit they would share the connection with the hero and
// the first row, so the paint that matters waits behind pictures nobody sees yet. Until the pictures
// in view have arrived (or 8 s after the page loaded) they load only from 100px outside the
// viewport; after that from 1250px, as the browser's own lazy loading would (it widens that distance
// on slower connections, the wrong way round here).
const SETTLE_MAX_MS = 8000
const TIGHT = '100px'
const WIDE = '1250px'
let settled = false
// Cards whose observer has not answered yet, or whose picture is on its way into the page (a
// transition): pictures in view may be among them, so the gate waits for them too.
let unanswered = 0
const settleListeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  const settle = () => {
    const since = performance.now()
    const timer = setInterval(() => {
      // Only images with a box: a lazy one in a hidden block (a collection's mosaic tiles past the
      // fourth) never loads, and held the gate shut for the whole 8 s.
      const loading =
        performance.now() - since < SETTLE_MAX_MS &&
        (unanswered > 0 ||
          [...document.images].some((i) => i.src && !i.complete && i.getClientRects().length))
      if (loading) return
      clearInterval(timer)
      settled = true
      settleListeners.forEach((fn) => fn())
    }, 250)
  }
  if (document.readyState === 'complete') settle()
  else window.addEventListener('load', settle, { once: true })
}
const onSettled = (fn: () => void) => {
  settleListeners.add(fn)
  return () => void settleListeners.delete(fn)
}

/** True once the pictures on the first screen have arrived (or 8 s passed; see above). */
export const useImagesSettled = () =>
  useSyncExternalStore(
    onSettled,
    () => settled,
    () => false,
  )

/**
 * [ref, near]: near turns true, and stays true, once the element is close to the viewport (see
 * above); `wanted` false starts it true. For the pictures of cards, which load when it turns true.
 */
export function useImageNear<T extends Element>(wanted: boolean) {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(!wanted || typeof IntersectionObserver !== 'function')
  const wide = useImagesSettled()
  useEffect(() => {
    const el = ref.current
    if (near || !el) return
    let open = true
    unanswered++
    // Counted until the observer answers "not near", or until near has rendered (this cleanup).
    const answer = () => {
      if (open) unanswered--
      open = false
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) startTransition(() => setNear(true))
        else answer()
      },
      // Once wide, the same distance inside a row that scrolls sideways: the next cards a row
      // pages to load before they show, as the browser's own lazy loading does.
      { rootMargin: wide ? WIDE : TIGHT, scrollMargin: wide ? WIDE : '0px' },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      answer()
    }
  }, [near, wide])
  return [ref, near] as const
}

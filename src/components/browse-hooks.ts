import { useState, useSyncExternalStore } from 'react'

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

// This tab's pages in history order, so Back on the player can step over the videos watched in a
// row (Up next, autoplay, More like this) to the page the first one was opened from. Entries are
// keyed by the router's location key, which survives a reload; sessionStorage keeps the list.
import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router'

interface Entry {
  key: string
  path: string
}

const STORAGE = 'upou:trail'
const MAX = 200

const isEntry = (e: unknown): e is Entry =>
  typeof e === 'object' &&
  e !== null &&
  typeof (e as Entry).key === 'string' &&
  typeof (e as Entry).path === 'string'

function load(): Entry[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(STORAGE) ?? '[]')
    return Array.isArray(value) ? value.filter(isEntry) : []
  } catch {
    return []
  }
}

let trail: Entry[] = load()
// The current entry; found again by its key after a reload (the first navigation is a POP).
let at = -1

function save() {
  try {
    sessionStorage.setItem(STORAGE, JSON.stringify(trail))
  } catch {
    // Storage unavailable: the trail still works until the tab reloads.
  }
}

/** Notes a navigation; exported for tests, the app calls it through `useTrail`. */
export function recordNavigation(key: string, path: string, type: 'PUSH' | 'REPLACE' | 'POP') {
  const found = trail.findIndex((e) => e.key === key)
  if (type === 'PUSH' && trail[at]?.key !== key) {
    // A new entry drops the forward ones it replaces.
    trail = [...trail.slice(0, at + 1), { key, path }].slice(-MAX)
    at = trail.length - 1
  } else if (type === 'REPLACE' && at >= 0) {
    trail[at] = { key, path }
  } else if (found >= 0) {
    // Back / Forward / reload onto a known entry.
    at = found
    trail[at] = { key, path }
  } else {
    // An entry the trail never saw: start over from it.
    trail = [{ key, path }]
    at = 0
  }
  save()
}

/** Forgets everything (tests). */
export function resetTrail() {
  trail = []
  at = -1
  save()
}

/** The current entry's place in the trail (0 = the earliest page it knows). */
export const trailIndex = () => at

/** Steps back to the nearest earlier page whose path `keep` accepts; null when none is known. */
export function stepsBackTo(keep: (path: string) => boolean): number | null {
  for (let i = at - 1; i >= 0; i--) if (keep(trail[i].path)) return at - i
  return null
}

/** Keeps the trail in step with the router; mounted once in the app shell. */
export function useTrail() {
  const { key, pathname } = useLocation()
  const type = useNavigationType()
  useEffect(() => recordNavigation(key, pathname, type), [key, pathname, type])
}

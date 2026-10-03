import { useCallback, useMemo, useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
const cache = new Map<string, unknown>()

function read<T>(key: string, fallback: T): T {
  if (cache.has(key)) return cache.get(key) as T
  let value = fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) value = JSON.parse(raw) as T
  } catch {
    // Storage blocked or corrupt: use the fallback.
  }
  cache.set(key, value)
  return value
}

function write<T>(key: string, value: T) {
  cache.set(key, value)
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota or private mode: keep the in-memory value.
  }
  listeners.forEach((l) => l())
}

// One window listener syncs changes made in other tabs.
function onStorage(e: StorageEvent) {
  if (e.key === null) cache.clear()
  else cache.delete(e.key)
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  if (!listeners.size) window.addEventListener('storage', onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (!listeners.size) window.removeEventListener('storage', onStorage)
  }
}

/** Test helper: forget cached values (e.g. after localStorage.clear()). */
export const resetStorageCache = () => cache.clear()

/** localStorage-backed state shared by every component using the same key. `fallback` must be stable. */
export function usePersistentState<T>(key: string, fallback: T) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  )
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = read(key, fallback)
      write(key, typeof next === 'function' ? (next as (p: T) => T)(prev) : next)
    },
    [key, fallback],
  )
  return [value, set] as const
}

// Stored values may be hand-edited or from an older version, so keep only well-formed items.
const MY_LIST_KEY = 'upou:my-list'
const NO_IDS: string[] = []
const toIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id) => typeof id === 'string') : NO_IDS

/** Adds a video to the front of My List, or removes it when it is already saved. */
export function toggleMyList(id: string) {
  const list = toIds(read<unknown>(MY_LIST_KEY, NO_IDS))
  write(MY_LIST_KEY, list.includes(id) ? list.filter((x) => x !== id) : [id, ...list])
}

export function useMyList() {
  const [raw] = usePersistentState<unknown>(MY_LIST_KEY, NO_IDS)
  const ids = useMemo(() => toIds(raw), [raw])
  const has = useCallback((id: string) => ids.includes(id), [ids])
  return { ids, has, toggle: toggleMyList }
}

/** Whether one video is saved: a boolean snapshot, so other list changes don't re-render the caller. */
export function useInMyList(id: string) {
  const saved = useSyncExternalStore(
    subscribe,
    () => toIds(read<unknown>(MY_LIST_KEY, NO_IDS)).includes(id),
    () => false,
  )
  const toggle = useCallback(() => toggleMyList(id), [id])
  return [saved, toggle] as const
}

export interface HistoryEntry {
  id: string
  at: number
}

const NO_HISTORY: HistoryEntry[] = []
const toEntries = (value: unknown): HistoryEntry[] =>
  Array.isArray(value) ? value.filter((e) => typeof e?.id === 'string') : NO_HISTORY

export function useWatchHistory() {
  const [raw, setEntries] = usePersistentState<unknown>('upou:history', NO_HISTORY)
  const entries = useMemo(() => toEntries(raw), [raw])
  const record = useCallback(
    (id: string) =>
      setEntries((prev: unknown) => {
        const rest = toEntries(prev).filter((e) => e.id !== id)
        return [{ id, at: Date.now() }, ...rest].slice(0, 20)
      }),
    [setEntries],
  )
  return { entries, record }
}

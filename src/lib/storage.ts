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
  Array.isArray(value) ? [...new Set(value.filter((id) => typeof id === 'string'))] : NO_IDS

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

const HISTORY_KEY = 'upou:history'
// Where each video stopped (savePosition below); kept only with "Remember where I stopped" on.
const POSITIONS_KEY = 'upou:positions'
export const SEARCHES_KEY = 'upou:searches'

/** The viewer's privacy and personalization choices (Privacy and history panel). */
export interface Prefs {
  /** Save watch history on this device; off deletes it and stops recording. */
  history: boolean
  /** Use watch history for anything: rows, recommendations, Up next ranking. */
  useHistory: boolean
  /** The "Recommended for you" row on the home page. */
  recommendations: boolean
  /** The "Recently viewed" row on the home page. */
  recentlyViewed: boolean
  /** The "Because you watched" rows on the home page. */
  becauseYouWatched: boolean
  /** Save committed searches (they seed recommendations); off deletes them. */
  searches: boolean
  /** Remember where each video stopped and resume there; off by default, off deletes the places. */
  resume: boolean
}

const PREFS_KEY = 'upou:prefs'
const PREF_KEYS = [
  'history',
  'useHistory',
  'recommendations',
  'recentlyViewed',
  'becauseYouWatched',
  'searches',
  'resume',
] as const
// Everything is on until the viewer says otherwise, except saved places (bookmarks), which they
// opt into.
const DEFAULT_PREFS: Prefs = {
  ...(Object.fromEntries(PREF_KEYS.map((k) => [k, true])) as unknown as Prefs),
  resume: false,
}

const toPrefs = (value: unknown): Prefs => {
  if (typeof value !== 'object' || value === null) return DEFAULT_PREFS
  const v = value as Record<string, unknown>
  return Object.fromEntries(
    PREF_KEYS.map((k) => [k, typeof v[k] === 'boolean' ? v[k] : DEFAULT_PREFS[k]]),
  ) as unknown as Prefs
}

/** Whether anything may draw on watch history. */
export const historyAllowed = (p: Prefs) => p.history && p.useHistory

/** Whether videos remember where they stopped (it rides on the saved watch history). */
export const resumeAllowed = (p: Prefs) => p.resume && p.history

/** Current choices outside React. */
export const readPrefs = (): Prefs => toPrefs(read<unknown>(PREFS_KEY, DEFAULT_PREFS))

/** Updates choices; opting out of saving a history deletes what was saved. */
export function setPrefs(patch: Partial<Prefs>) {
  write(PREFS_KEY, { ...readPrefs(), ...patch })
  if (patch.history === false) {
    write(HISTORY_KEY, [])
    write(POSITIONS_KEY, [])
  }
  if (patch.resume === false) write(POSITIONS_KEY, [])
  if (patch.searches === false) write(SEARCHES_KEY, [])
}

export function usePrefs() {
  const [raw] = usePersistentState<unknown>(PREFS_KEY, DEFAULT_PREFS)
  const prefs = useMemo(() => toPrefs(raw), [raw])
  return [prefs, setPrefs] as const
}

const NO_HISTORY: HistoryEntry[] = []
const MAX_HISTORY = 20
// Newest first: an id seen twice keeps its newer entry; the cap holds for stored lists too.
const toEntries = (value: unknown): HistoryEntry[] => {
  if (!Array.isArray(value)) return NO_HISTORY
  const seen = new Set<string>()
  return value
    .filter((e) => typeof e?.id === 'string' && !seen.has(e.id) && seen.add(e.id))
    .slice(0, MAX_HISTORY)
}

export function useWatchHistory() {
  const [raw, setEntries] = usePersistentState<unknown>(HISTORY_KEY, NO_HISTORY)
  const entries = useMemo(() => toEntries(raw), [raw])
  const record = useCallback(
    (id: string) => {
      if (!readPrefs().history) return
      setEntries((prev: unknown) => {
        const rest = toEntries(prev).filter((e) => e.id !== id)
        return [{ id, at: Date.now() }, ...rest].slice(0, MAX_HISTORY)
      })
    },
    [setEntries],
  )
  const clear = useCallback(() => {
    setEntries(NO_HISTORY)
    write(POSITIONS_KEY, [])
  }, [setEntries])
  return { entries, record, clear }
}

// Where each video stopped, so the player starts there next time ("Resumed at 1:15"). Part of the
// watch history: kept only while it is saved, deleted with it, used only while it may be used.
const MAX_POSITIONS = 200
// Seconds that must play before a place is kept; until then an earlier one stands.
const RESUME_FROM_S = 10
// The last 5 % or 30 s, whichever is longer, count as finished.
const END_SHARE = 0.05
const END_S = 30

interface Position {
  id: string
  /** Whole seconds played. */
  t: number
  at: number
}

const NO_POSITIONS: Position[] = []
const toPositions = (value: unknown): Position[] =>
  Array.isArray(value)
    ? value.filter((e) => typeof e?.id === 'string' && Number.isFinite(e.t) && e.t > 0)
    : NO_POSITIONS

/** Where this browser left video `id`, in whole seconds, while saved places are on. */
export function readPosition(id: string): number | undefined {
  if (!resumeAllowed(readPrefs())) return undefined
  return toPositions(read<unknown>(POSITIONS_KEY, NO_POSITIONS)).find((e) => e.id === id)?.t
}

/** readPosition, following storage (another tab, the player leaving, a privacy change). */
export const useSavedPosition = (id: string) =>
  useSyncExternalStore(
    subscribe,
    () => readPosition(id),
    () => undefined,
  )

/**
 * Keeps where video `id` stopped (`t` of `length` seconds), newest first, the last 200. Under
 * RESUME_FROM_S nothing changes; near the end (see END_S) the place is forgotten, so a finished
 * video starts fresh. Nothing is kept unless saved places are on.
 */
export function savePosition(id: string, t: number, length?: number) {
  if (!resumeAllowed(readPrefs()) || t < RESUME_FROM_S) return
  if (length !== undefined && t >= length - Math.max(length * END_SHARE, END_S))
    return forgetPosition(id)
  const rest = toPositions(read<unknown>(POSITIONS_KEY, NO_POSITIONS)).filter((e) => e.id !== id)
  write(POSITIONS_KEY, [{ id, t: Math.floor(t), at: Date.now() }, ...rest].slice(0, MAX_POSITIONS))
}

/** Forgets where video `id` stopped (it played to the end). */
export function forgetPosition(id: string) {
  const list = toPositions(read<unknown>(POSITIONS_KEY, NO_POSITIONS))
  const rest = list.filter((e) => e.id !== id)
  if (rest.length < list.length) write(POSITIONS_KEY, rest)
}

/** Watch page state that plays video `id` from the start, passing over its saved place `t`. */
export const fromStart = (id: string, t: number) => ({ fromStart: { id, t } })

/**
 * Whether a watch page's state asks to play video `id` from the start. Only while the place it
 * passed over is still the saved one: once 10 s have played again, Back or a reload resumes.
 */
export function startsOver(state: unknown, id: string) {
  const asked = (state as { fromStart?: { id?: unknown; t?: unknown } } | null)?.fromStart
  return asked?.id === id && asked.t === readPosition(id)
}

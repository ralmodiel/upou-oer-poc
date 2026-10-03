import { useCallback, useMemo } from 'react'
import {
  type HistoryEntry,
  historyAllowed,
  readPrefs,
  SEARCHES_KEY,
  useMyList,
  usePersistentState,
  usePrefs,
  useWatchHistory,
} from './storage'

export { SEARCHES_KEY }

export interface SearchEntry {
  q: string
  at: number
}

/** Everything the recommender knows about this browser's user; all of it lives in localStorage. */
export interface Profile {
  watched: { id: string; at: number }[]
  searches: { q: string; at: number }[]
  saved: string[]
}

// Keys shared with storage.ts (history and My List) plus this module's own.
const HISTORY_KEY = 'upou:history'
const MY_LIST_KEY = 'upou:my-list'
const MAX_SEARCHES = 20
const MIN_QUERY_LENGTH = 2

const NO_SEARCHES: SearchEntry[] = []
const NO_ENTRIES: HistoryEntry[] = []
const NO_IDS: string[] = []

// Stored values may be hand-edited or from an older version, so keep only well-formed items.
const toSearches = (value: unknown): SearchEntry[] =>
  Array.isArray(value) ? value.filter((e) => typeof e?.q === 'string') : NO_SEARCHES
const toEntries = (value: unknown): HistoryEntry[] =>
  Array.isArray(value) ? value.filter((e) => typeof e?.id === 'string') : NO_ENTRIES
const toIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id) => typeof id === 'string') : NO_IDS

const cleanQuery = (q: string) => q.trim().replace(/\s+/g, ' ')

/** Adds a committed query to the front of the list (case-insensitive dedupe, last 20 kept). */
export const addSearch = (list: SearchEntry[], q: string, at = Date.now()): SearchEntry[] => {
  const query = cleanQuery(q)
  if (query.length < MIN_QUERY_LENGTH) return list
  const key = query.toLowerCase()
  const rest = list.filter((e) => e.q.toLowerCase() !== key)
  return [{ q: query, at }, ...rest].slice(0, MAX_SEARCHES)
}

/** Recent committed searches, newest first. Call `record` once per committed query. */
export function useSearchHistory() {
  const [raw, setRaw] = usePersistentState<unknown>(SEARCHES_KEY, NO_SEARCHES)
  const searches = useMemo(() => toSearches(raw), [raw])
  const record = useCallback(
    (q: string) => {
      if (!readPrefs().searches) return
      setRaw((prev: unknown) => addSearch(toSearches(prev), q))
    },
    [setRaw],
  )
  const clear = useCallback(() => setRaw(NO_SEARCHES), [setRaw])
  return { searches, record, clear }
}

const NONE: never[] = []

/**
 * Watch history, searches and My List as one object; same identity until storage changes.
 * Leaves out whatever the viewer opted out of (Privacy and history panel).
 */
export function useProfile(): Profile {
  const { entries } = useWatchHistory()
  const { searches } = useSearchHistory()
  const { ids } = useMyList()
  const [prefs] = usePrefs()
  const watchedOk = historyAllowed(prefs)
  const searchesOk = prefs.searches
  return useMemo(
    () => ({
      watched: watchedOk ? entries : NONE,
      searches: searchesOk ? searches : NONE,
      saved: ids,
    }),
    [watchedOk, searchesOk, entries, searches, ids],
  )
}

const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** The profile outside React (scripts, loaders, tests): a fresh read of localStorage. */
export function readProfile(): Profile {
  const prefs = readPrefs()
  return {
    watched: historyAllowed(prefs) ? toEntries(readJson(HISTORY_KEY)) : NONE,
    searches: prefs.searches ? toSearches(readJson(SEARCHES_KEY)) : NONE,
    saved: toIds(readJson(MY_LIST_KEY)),
  }
}

export const isEmptyProfile = (p: Profile): boolean =>
  !p.watched.length && !p.searches.length && !p.saved.length

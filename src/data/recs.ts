import data from './recs.json'

/** Precomputed neighbors of one video: [catalog index, score 0..1] pairs, best first. */
export type Neighbors = readonly (readonly [number, number])[]

/**
 * Optional transcript-based neighbors keyed by YouTube id, written by scripts/text/build-recs.mjs.
 * The shipped file is `{}` until transcripts are ingested; the engine works without it.
 */
let table: Record<string, Neighbors> = data as Record<string, Neighbors>

const NONE: Neighbors = []

const isPair = (x: unknown): x is readonly [number, number] =>
  Array.isArray(x) && Number.isInteger(x[0]) && typeof x[1] === 'number'

export const neighborsOf = (youtubeId: string): Neighbors => {
  const list = table[youtubeId]
  return Array.isArray(list) ? list.filter(isPair) : NONE
}

/** Test hook: swap the neighbor table (pass `{}` to clear it). */
export const setNeighbors = (next: Record<string, Neighbors>): void => {
  table = next
}

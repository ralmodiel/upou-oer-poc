// The catalog as the browser downloads it: catalog.json with frame-flags.json and speakers.json
// joined in by the build (vite.config.ts), by position rather than keyed by YouTube id (random ids
// barely compress), and without the ids a title already gives. About a quarter smaller gzipped
// than the three files, and parsed in one JSON.parse. No runtime imports, so the build shares it.
import type { CatalogRecord } from '../types'

/** A record whose id is its title's slug leaves the id out. */
export type PackedRecord = Omit<CatalogRecord, 'id'> & { id?: string }

export interface CatalogPack {
  /** catalog.json's records in order; malformed ones as they are (expandCatalog skips them). */
  records: PackedRecord[]
  /** Per record, its frame-flags.json value (0: nothing known). */
  flags: number[]
  /** Per record, its speakers.json names (0: none named). */
  speakers: (string[] | 0)[]
}

/**
 * The slug the source site gives most titles: "Women’s Month Forum" → "womens-month-forum". Ids it
 * gets wrong ("-2" suffixes, edited titles) stay in the pack.
 */
export const slugOfTitle = (title: string): string =>
  title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['’+&]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
    .replace(/-$/, '')

type Table<T> = Readonly<Record<string, T>>

const own = <T>(table: Table<T>, key: unknown): T | undefined =>
  typeof key === 'string' && Object.hasOwn(table, key) ? table[key] : undefined

const isRecordLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Joins the three tables (build time). */
export function packCatalog(
  records: readonly unknown[],
  flags: Table<unknown>,
  speakers: Table<string[]>,
): CatalogPack {
  const pack: CatalogPack = { records: [], flags: [], speakers: [] }
  for (const r of records) {
    let out = r as PackedRecord
    if (isRecordLike(r) && typeof r.t === 'string' && r.id === slugOfTitle(r.t)) {
      out = { ...(r as PackedRecord) }
      delete out.id
    }
    const y = isRecordLike(r) ? r.y : undefined
    const value = own(flags, y)
    pack.records.push(out)
    pack.flags.push(typeof value === 'number' ? value : 0)
    pack.speakers.push(own(speakers, y) ?? 0)
  }
  return pack
}

/** The records with their ids back, in place (the browser, before expandCatalog). */
export function unpackRecords(pack: CatalogPack): unknown[] {
  for (const r of pack.records as unknown[])
    if (isRecordLike(r) && r.id === undefined && typeof r.t === 'string') r.id = slugOfTitle(r.t)
  return pack.records
}

/** A per-record column as a table keyed by YouTube id, as frame-flags.json and speakers.json are. */
export function tableOf<T>(pack: CatalogPack, column: readonly (T | 0)[]): Record<string, T> {
  const table: Record<string, T> = {}
  pack.records.forEach((r, i) => {
    const value = column[i]
    if (value && isRecordLike(r) && typeof r.y === 'string') table[r.y] = value
  })
  return table
}

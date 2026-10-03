import type { CatalogRecord, Video } from '../types'
import { replaceCatalog } from './catalog'
import { expandCatalog } from './expand'

/**
 * Swaps the in-memory catalog for fixtures (slim records or full videos) and clears memoized
 * collections, so tests need not mock catalog.json. Call it at the top of a test file or in
 * beforeEach; it stays in effect for that file. Modules that copy catalog data at import time
 * (rather than calling the getters in render) keep what they captured.
 */
export const setCatalog = (videos: readonly (Video | CatalogRecord)[]): void =>
  replaceCatalog(expandCatalog(videos))

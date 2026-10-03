// Checks on the slim catalog records. No runtime imports, so the build (vite.config.ts) shares it.
import type { CatalogRecord } from '../types'

const ID_RE = /^[a-z0-9-]+$/
const YOUTUBE_ID_RE = /^[\w-]{11}$/

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const text = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

/** The fields the UI relies on; the crawler guarantees the rest. */
export const isValidRecord = (value: unknown): value is CatalogRecord =>
  isObject(value) &&
  typeof value.id === 'string' &&
  ID_RE.test(value.id) &&
  typeof value.y === 'string' &&
  YOUTUBE_ID_RE.test(value.y) &&
  text(value.t) &&
  text(value.c) &&
  typeof value.p === 'string' &&
  !Number.isNaN(Date.parse(value.p))

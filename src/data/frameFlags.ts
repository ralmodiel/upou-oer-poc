import crops from './frame-crops.json'
import {
  beautyBitsOf,
  duplicatePairsOf,
  fallbackOf,
  flagsOf,
  keepOf,
  maskOf,
  rankingOf,
  slideBitsOf,
  youtubeIdOf,
  zoomFrom,
  type Box,
} from './images'
import { tableOf, type CatalogPack } from './pack'

/**
 * What the frame analysis (scripts/faces) knows about each video's thumbnail candidates, keyed by
 * YouTube id. Candidate 0 is YouTube's thumbnail (mqdefault), 1-3 its stills (mq1-mq3, about 25%,
 * 50% and 75% into the video). Each value packs, by bit:
 *
 * - 0-3: candidate i is flagged (a face not smiling, talking, angry, eyes closed or awkward; a dark,
 *   blank, washed-out or colour-cast still; a still YouTube does not serve)
 * - 4-5: the least bad candidate, meaningful only when all four are flagged
 * - 6-8: near-duplicate stills: bit 6 = stills 1 and 2, bit 7 = 1 and 3, bit 8 = 2 and 3
 * - 9-12: candidate i is slide-like (text on a flat background, no face)
 * - 13-16: candidate i is beautiful (unflagged and well scored: a good smile, open eyes, frontal)
 * - 17-24: the ranking, best first: 2 bits per place (place p at bits 17 + 2p); 0 when unranked
 * - 25: the video's reel has one still, and bits 26-41 say what a camera move on it keeps in view
 *   (its faces; a slide's or title card's text): x0, y0, x1 - 1, y1 - 1 in 16ths of the frame at
 *   4 bits each. Values pass 2^31 here, so these bits are read with arithmetic.
 *
 * Videos with nothing to say (0) are absent. Decoders live in images.ts, which the SEO generator
 * shares. The browser gets the values of catalog videos only, packed with the catalog (pack.ts).
 *
 * frame-crops.json (same pipeline) holds, for stills with black bars baked in on every side, the
 * zoom per candidate that pushes the bars out of a 16:9 slot, cutting at most 2% of the picture:
 * one number, or [zoom for the 16:9 sizes, zoom for the 4:3 ones] when they differ.
 */
// Filled part by part as the catalog arrives (catalog.ts), before its videos are expanded.
let table: Record<string, number> = {}
let cropTable: Record<string, unknown> = crops

/** The packed value of a video (0 when nothing is known). */
export const frameFlagsOf = (youtubeId: string): number => flagsOf(table[youtubeId])

/** Bit mask of the flagged thumbnail candidates of a video. */
export const flaggedMaskOf = (youtubeId: string): number => maskOf(table[youtubeId])

/** The least bad candidate when all four are flagged (else 0). */
export const fallbackIndexOf = (youtubeId: string): number => fallbackOf(table[youtubeId])

/** Pairs of stills that show the same shot. */
export const nearDuplicatesOf = (youtubeId: string) => duplicatePairsOf(table[youtubeId])

/** Bit mask of the slide-like candidates. */
export const slideMaskOf = (youtubeId: string): number => slideBitsOf(table[youtubeId])

/** Bit mask of the beautiful candidates. */
export const beautifulMaskOf = (youtubeId: string): number => beautyBitsOf(table[youtubeId])

/** Candidates best first, or undefined when the video was not ranked. */
export const rankOf = (youtubeId: string): number[] | undefined => rankingOf(table[youtubeId])

/** What a move on the reel's one still must keep in view, in fractions of the frame. */
export const keepBoxOf = (youtubeId: string): Box | undefined => keepOf(table[youtubeId])

/** The zoom that pushes black bars baked into a YouTube image out of its 16:9 slot (1: none). */
export function cropZoomOf(src: string): number {
  const id = youtubeIdOf(src)
  return id ? zoomFrom(cropTable[id], src) : 1
}

/** Adds a part's flags (catalog.ts), before its videos are expanded. */
export const addFrameFlags = (pack: CatalogPack): void => {
  Object.assign(table, tableOf(pack, pack.flags))
}

/** Test hook: swap the flag table (pass `{}` to clear it). */
export const setFrameFlags = (next: Record<string, number>): void => {
  table = next
}

/** Test hook: swap the crop table (pass `{}` to clear it). */
export const setFrameCrops = (next: Record<string, unknown>): void => {
  cropTable = next
}

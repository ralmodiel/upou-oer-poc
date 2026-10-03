import data from './frame-flags.json'
import {
  beautyBitsOf,
  duplicatePairsOf,
  fallbackOf,
  flagsOf,
  maskOf,
  rankingOf,
  slideBitsOf,
} from './images'

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
 *
 * Videos with nothing to say (0) are absent. Decoders live in images.ts, which the SEO generator
 * shares.
 */
let table: Record<string, number> = data as Record<string, number>

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

/** Test hook: swap the flag table (pass `{}` to clear it). */
export const setFrameFlags = (next: Record<string, number>): void => {
  table = next
}

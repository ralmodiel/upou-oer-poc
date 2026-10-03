import data from './frame-flags.json'

/**
 * Still frames that show a face that is not smiling (or looks angry / caught mid-speech), keyed by
 * YouTube id: bit i of the mask marks thumbnail candidate i (mqdefault, mq1, mq2, mq3). Written by
 * scripts/faces/apply.mjs from the MediaPipe face scores; videos without flags are absent.
 */
let table: Record<string, number> = data as Record<string, number>

/** Bit mask of the flagged thumbnail candidates of a video (0 when none are known). */
export const flaggedMaskOf = (youtubeId: string): number => {
  const mask = table[youtubeId]
  return Number.isInteger(mask) && mask > 0 ? mask & 0b1111 : 0
}

/** Test hook: swap the flag table (pass `{}` to clear it). */
export const setFrameFlags = (next: Record<string, number>): void => {
  table = next
}

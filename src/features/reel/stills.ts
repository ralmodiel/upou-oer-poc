import { flaggedMaskOf, slideMaskOf } from '../../data/frameFlags'
import type { Video } from '../../types'

/** A reel still at two sizes: `src` for the watch stage, `small` (320px) for card previews. */
export interface Still {
  src: string
  small: string
  /** A slide or title card (text on a flat background, no face): show it whole, move it gently. */
  slide?: true
}

// Candidate index as in frame-flags.json: YouTube's still frames are 1-3; anything else (the
// original thumbnail at any size, or the source site's og:image) is the original, 0.
const candidateOf = (src: string) =>
  Number(/\/(?:maxres|sd|hq|mq)([1-3])\.jpg$/.exec(src)?.[1] ?? 0)

/** Whether reel frame `i` of a video (`video.frames[i]`) is slide-like. */
export const isSlideFrame = (video: Video, i: number): boolean => video.slides?.[i] ?? false

/**
 * The images the reel and the player poster may show. Flagged candidates (a face not smiling,
 * eyes closed or awkward; a dark, blank or colour-cast still) are dropped wherever they come from,
 * catalog fallbacks included, so a video whose every image is flagged gets no image at all and its
 * reel plays on type alone. The frames arrive best first (see src/data/images.ts).
 */
export function reelImages(video: Video) {
  const mask = flaggedMaskOf(video.youtubeId)
  const slides = slideMaskOf(video.youtubeId)
  const ok = (src?: string): src is string => !!src && !(mask & (1 << candidateOf(src)))
  const small = video.thumbnails?.slice(1) ?? []
  return {
    stills: video.frames
      .map((src, i): Still => ({
        src,
        small: small[i] ?? src,
        ...((slides & (1 << candidateOf(src)) || isSlideFrame(video, i)) && { slide: true }),
      }))
      .filter((still) => ok(still.src)),
    /** Shared by the reel's end card and the player poster, so the hand-off has nothing to load. */
    poster: [video.poster, video.backdrop, ...video.frames].find(ok) ?? null,
    /** The card's own image, which previews open on. */
    thumbnail: ok(video.thumbnail) ? video.thumbnail : null,
  }
}

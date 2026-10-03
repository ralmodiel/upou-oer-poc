import type { Video } from '../../types'
import { reelImages } from './stills'

/** Longest the reel waits for its stills before starting anyway. */
export const DECODE_CAP_MS = 1200

const decoded = new Map<string, Promise<boolean>>()
const warmed = new Set<string>()

/** Loads and decodes an image once; resolves false if it fails or is YouTube's 120px "missing" placeholder. */
function decodeImage(src: string): Promise<boolean> {
  const cached = decoded.get(src)
  if (cached) return cached
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  const ready =
    typeof img.decode === 'function'
      ? img.decode()
      : new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = reject
        })
  const result = ready.then(
    () => img.naturalWidth > 120,
    () => false,
  )
  decoded.set(src, result)
  // Allow a retry later if this attempt failed.
  void result.then((ok) => ok || decoded.delete(src))
  return result
}

/**
 * Per-image success, waiting at most `capMs`; images still pending count as fine. The web fonts
 * are waited for too (within the cap), so the reel's type never swaps mid-animation. Aborting
 * settles at once and clears the timer; callers check the signal before using the result.
 */
export function settleImages(
  srcs: readonly string[],
  capMs: number,
  signal?: AbortSignal,
): Promise<boolean[]> {
  const status = srcs.map(() => true)
  const loads = srcs.map((src, i) =>
    decodeImage(src).then((ok) => {
      status[i] = ok
    }),
  )
  // jsdom has no FontFaceSet.
  const fonts = (document as { fonts?: FontFaceSet }).fonts?.ready
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve(status)
    }
    const timer = setTimeout(done, capMs)
    signal?.addEventListener('abort', done)
    void Promise.all([...loads, fonts]).then(done)
  })
}

/** Warms the watch chunk and reel images before the user presses Play. */
export function preloadReel(video: Video) {
  if (warmed.has(video.id)) return
  warmed.add(video.id)
  import('../../pages/WatchPage').catch(() => {})
  // The stills and the poster the watch stage ends on (flagged ones never load).
  const { poster, stills } = reelImages(video)
  for (const src of new Set([poster, ...stills.map((s) => s.src)])) if (src) void decodeImage(src)
}

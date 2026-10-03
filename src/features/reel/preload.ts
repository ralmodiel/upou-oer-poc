import type { Video } from '../../types'

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

/** Per-image success, waiting at most `capMs`; images still pending count as fine. */
export function settleImages(srcs: readonly string[], capMs: number): Promise<boolean[]> {
  const status = srcs.map(() => true)
  const all = Promise.all(
    srcs.map((src, i) =>
      decodeImage(src).then((ok) => {
        status[i] = ok
      }),
    ),
  )
  let timer: ReturnType<typeof setTimeout> | undefined
  const cap = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, capMs)
  })
  return Promise.race([all, cap]).then(() => {
    clearTimeout(timer)
    return status
  })
}

/** Warms the watch chunk and reel images before the user presses Play. */
export function preloadReel(video: Video) {
  if (warmed.has(video.id)) return
  warmed.add(video.id)
  import('../../pages/WatchPage').catch(() => {})
  for (const src of [video.backdrop, ...video.frames]) void decodeImage(src)
}

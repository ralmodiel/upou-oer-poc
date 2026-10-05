const ID = /^[\w-]{11}$/

export const isYouTubeId = (id: string) => ID.test(id)

/** Privacy-enhanced embed URL. */
export function embedUrl(youtubeId: string, autoplay = true): string {
  if (!isYouTubeId(youtubeId)) throw new Error(`Invalid YouTube id: ${youtubeId}`)
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    rel: '0',
    playsinline: '1',
  })
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params}`
}

export const watchUrl = (youtubeId: string) =>
  `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`

/**
 * Whether the player may load behind the preview: not when the viewer asks to save data (Save-Data,
 * or prefers-reduced-data where a browser supports it).
 */
export const mayPreload = () =>
  !(navigator as { connection?: { saveData?: boolean } }).connection?.saveData &&
  !matchMedia('(prefers-reduced-data: reduce)').matches

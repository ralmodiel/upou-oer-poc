import type { SyntheticEvent } from 'react'
import type { Video } from '../types'
import { largeImageOf } from './media'

const markLoaded = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.dataset.loaded = ''
}
// A missing large still falls back to the 320px thumbnail; if that fails too, the scrim alone stays.
const retryOrFail = (img: HTMLImageElement, fallback: string) => {
  if (img.getAttribute('src') !== fallback) img.src = fallback
  else img.dataset.failed = ''
}

interface Props {
  video: Video
  /** Gradient layer(s) over the still, fading it into the block's background. */
  scrim: string
  /** Position overrides for the root (it fills its positioned parent by default). */
  className?: string
}

/**
 * Decorative, blurred still of a video behind a block. Absolutely positioned behind the
 * content (the parent needs `relative isolate`), so it never affects layout.
 */
export default function Backdrop({ video, scrim, className = '' }: Props) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}
    >
      <img
        key={video.id}
        src={largeImageOf(video)}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={markLoaded}
        onError={(e) => retryOrFail(e.currentTarget, video.thumbnail)}
        className="backdrop-img size-full object-cover opacity-0 transition-opacity duration-700 data-loaded:opacity-100 data-failed:hidden motion-reduce:transition-none"
      />
      <div className={`absolute inset-0 ${scrim}`} />
    </div>
  )
}

import type { ImgHTMLAttributes, ReactNode, SyntheticEvent } from 'react'
import type { Video } from '../types'
import { largeImageOf, srcSetOf } from './media'

const markLoaded = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.dataset.loaded = ''
}
// A missing 1280px still falls back to the 320px thumbnail; only when that fails too does the
// placeholder stay.
const retryOrFail = (img: HTMLImageElement, fallback: string) => {
  if (img.srcset || img.src !== fallback) {
    img.srcset = ''
    img.src = fallback
    return
  }
  img.dataset.failed = ''
}

interface Props extends Pick<ImgHTMLAttributes<HTMLImageElement>, 'loading' | 'fetchPriority'> {
  video: Video
  /** `sizes` for the slot the image sits in. */
  sizes: string
  /** Prefer the 1280px still (featured block, dialog). */
  large?: boolean
  /** Wrapper classes: radius, ring, hover effects, grid order. */
  className?: string
  /** Overlays (play glyph). */
  children?: ReactNode
}

/**
 * 16:9 still on a surface-2 well that shows the collection's initial underneath, so a slow or
 * missing image never reads as a blank block. Lazy images fade in; eager ones (LCP) paint at once.
 */
export default function Thumbnail({
  video,
  sizes,
  large = false,
  className = '',
  children,
  loading = 'lazy',
  fetchPriority,
}: Props) {
  const fade = loading === 'lazy'
  return (
    <div className={`relative aspect-video overflow-hidden bg-surface-2 @container ${className}`}>
      <span
        aria-hidden="true"
        className="absolute inset-0 grid place-items-center font-display text-[length:clamp(1.25rem,22cqi,2.75rem)] text-ink-3/50 select-none"
      >
        {video.category.charAt(0)}
      </span>
      <img
        key={video.id}
        src={large ? largeImageOf(video) : video.thumbnail}
        srcSet={srcSetOf(video)}
        sizes={sizes}
        alt=""
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        onLoad={markLoaded}
        onError={(e) => retryOrFail(e.currentTarget, video.thumbnail)}
        className={`relative size-full object-cover data-failed:hidden ${
          fade
            ? 'opacity-0 transition-opacity duration-300 data-loaded:opacity-100 motion-reduce:transition-none'
            : ''
        }`}
      />
      {children}
    </div>
  )
}

import type { ImgHTMLAttributes, ReactNode, SyntheticEvent } from 'react'
import type { Video } from '../types'
import { useImageNear } from './browse-hooks'
import { cardSrcSet, thumbnailOf, tileToneOf, zoomStyle } from './media'
import { BAND } from './tones'

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

/**
 * Stand-in for a video with no usable image (every still flagged): its title in the display serif
 * on the collection's brand band under a short rule, like the reel's type-only cards; never a blank
 * or dark box. Narrow tiles keep the title, in two lines. Decorative: the card names the video
 * already.
 */
export function TitleTile({ video, className = '' }: { video: Video; className?: string }) {
  const band = BAND[tileToneOf(video)]
  return (
    <div
      aria-hidden="true"
      data-title-tile=""
      className={`absolute inset-0 overflow-hidden select-none @container ${band.fill} ${band.text} ${className}`}
    >
      <div className="flex size-full flex-col justify-end p-[7cqi] @max-[8rem]:p-[6cqi]">
        <span
          className={`mb-[4cqi] h-[clamp(2px,0.9cqi,5px)] w-[min(16cqi,4rem)] shrink-0 rounded-pill ${band.rule}`}
        />
        <span className="line-clamp-3 font-display text-[length:clamp(0.75rem,9.5cqi,2.25rem)] leading-[1.08] text-balance @max-[8rem]:line-clamp-2">
          {video.title}
        </span>
      </div>
    </div>
  )
}

interface Props extends Pick<ImgHTMLAttributes<HTMLImageElement>, 'loading' | 'fetchPriority'> {
  video: Video
  /** `sizes` for the slot the image sits in. */
  sizes: string
  /** Prefer the 1280px still (featured block, dialog). */
  large?: boolean
  /** The original still instead of this page load's rotating pick (hero slots, lists). */
  canonical?: boolean
  /** Wrapper classes: radius, ring, hover effects, grid order. */
  className?: string
  /** Overlays (play glyph). */
  children?: ReactNode
}

/**
 * 16:9 still on a plain surface-2 well (no letter or tile while it loads); a video whose every
 * image is flagged shows its least bad one, never a plain colour tile. Black bars baked into the
 * still are zoomed out of the box. Lazy images fade in; eager ones (LCP) paint at once.
 */
export default function Thumbnail({
  video,
  sizes,
  large = false,
  canonical = false,
  className = '',
  children,
  loading = 'lazy',
  fetchPriority,
}: Props) {
  const fade = loading === 'lazy'
  const images = thumbnailOf(video, canonical)
  const [ref, near] = useImageNear<HTMLDivElement>(fade)
  return (
    <div
      ref={ref}
      className={`relative aspect-video overflow-hidden bg-surface-2 @container ${className}`}
    >
      <img
        key={video.id}
        src={near ? (large ? images.large : images.small) : undefined}
        srcSet={near ? (large ? images.srcSet : cardSrcSet(images.srcSet)) : undefined}
        sizes={sizes}
        alt=""
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        onLoad={markLoaded}
        onError={(e) => retryOrFail(e.currentTarget, images.small)}
        style={zoomStyle(images.zoom)}
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

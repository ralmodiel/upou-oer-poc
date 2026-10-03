import type { ImgHTMLAttributes, ReactNode, SyntheticEvent } from 'react'
import type { Video } from '../types'
import { imagesOf, slugOfCategory } from './media'
import { BAND, toneOf, type Tone } from './tones'

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

// Title tiles use the collection's band colour; charcoal would read as a dark box among stills.
const TILE_TONE: Record<Tone, Tone> = {
  maroon: 'maroon',
  forest: 'forest',
  gold: 'gold',
  charcoal: 'maroon',
}

/**
 * Stand-in for a video with no usable image (every still flagged): its title in the display serif
 * on the collection's brand band under a short rule, like the reel's type-only cards; never a blank
 * or dark box. Below 8rem wide it shows the title's first letter instead. Decorative: the card
 * names the video already.
 */
export function TitleTile({ video, className = '' }: { video: Video; className?: string }) {
  const band = BAND[TILE_TONE[toneOf(slugOfCategory(video.category))]]
  return (
    <div
      aria-hidden="true"
      data-title-tile=""
      className={`absolute inset-0 overflow-hidden select-none @container ${band.fill} ${band.text} ${className}`}
    >
      <div className="flex size-full flex-col justify-end p-[7cqi] @max-[8rem]:hidden">
        <span
          className={`mb-[4cqi] h-[clamp(2px,0.9cqi,5px)] w-[min(16cqi,4rem)] shrink-0 rounded-pill ${band.rule}`}
        />
        <span className="line-clamp-3 font-display text-[length:clamp(0.75rem,9.5cqi,2.25rem)] leading-[1.08] text-balance">
          {video.title}
        </span>
      </div>
      <span className="hidden size-full place-items-center font-display text-[length:50cqi] leading-none @max-[8rem]:grid">
        {video.title.charAt(0)}
      </span>
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
 * 16:9 still on a surface-2 well that shows the collection's initial underneath, so a slow or
 * missing image never reads as a blank block; a video whose every image is flagged gets its title
 * tile instead. Lazy images fade in; eager ones (LCP) paint at once.
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
  const images = imagesOf(video, canonical)
  return (
    <div className={`relative aspect-video overflow-hidden bg-surface-2 @container ${className}`}>
      <span
        aria-hidden="true"
        className="absolute inset-0 grid place-items-center font-display text-[length:clamp(1.25rem,22cqi,2.75rem)] text-ink-3/50 select-none"
      >
        {video.category.charAt(0)}
      </span>
      {!images && <TitleTile video={video} />}
      {images && (
        <img
          key={video.id}
          src={large ? images.large : images.small}
          srcSet={images.srcSet}
          sizes={sizes}
          alt=""
          loading={loading}
          fetchPriority={fetchPriority}
          decoding="async"
          onLoad={markLoaded}
          onError={(e) => retryOrFail(e.currentTarget, images.small)}
          className={`relative size-full object-cover data-failed:hidden ${
            fade
              ? 'opacity-0 transition-opacity duration-300 data-loaded:opacity-100 motion-reduce:transition-none'
              : ''
          }`}
        />
      )}
      {children}
    </div>
  )
}

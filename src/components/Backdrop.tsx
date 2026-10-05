import type { SyntheticEvent } from 'react'
import type { Video } from '../types'
import { imagesOf, zoomStyle } from './media'

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

const hide = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.dataset.failed = ''
}

/**
 * Decorative strip of a few videos' original stills in their own colours: 16:9 tiles the height of
 * its positioned parent, as many as fit. It sits beside a brand band, never under one, so no type
 * covers it and it needs no scrim. The tiles past `FIRST` show only from sm up to md (a phone on
 * its side), where four (142px each at the band's 80px) would stop short of the screen's edge.
 */
const FIRST = 4
export function MosaicBackdrop({
  videos,
  count = 8,
  className = '',
}: {
  videos: readonly Video[]
  count?: number
  className?: string
}) {
  // Only videos with a usable still: one whose every image is flagged would leave a blank tile.
  const shown = videos.filter((v) => imagesOf(v, true)).slice(0, count)
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div className="flex h-full gap-0.5">
        {shown.map((video, i) => {
          const images = imagesOf(video, true)
          return (
            <div
              key={video.id}
              className={`aspect-video h-full shrink-0 overflow-hidden bg-surface-2 ${i < FIRST ? '' : 'hidden sm:max-md:block'}`}
            >
              {images && (
                <img
                  src={images.small}
                  style={zoomStyle(images.zoom)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onLoad={markLoaded}
                  onError={hide}
                  className="size-full object-cover opacity-0 transition-opacity duration-700 data-loaded:opacity-100 data-failed:invisible motion-reduce:transition-none"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Decorative, blurred still of a video behind a block. Absolutely positioned behind the
 * content (the parent needs `relative isolate`), so it never affects layout.
 */
export default function Backdrop({ video, scrim, className = '' }: Props) {
  // The canonical still, fully grey in browse.css: a tone behind the page, never a colour wash
  // (none when every image is flagged).
  const images = imagesOf(video, true)
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}
    >
      {/* The bars zoom sits on a wrapper, so the drift's own scale adds to it. */}
      {images && (
        <div style={zoomStyle(images.zoom)} className="size-full">
          <img
            key={video.id}
            src={images.large}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={markLoaded}
            onError={(e) => retryOrFail(e.currentTarget, images.small)}
            className="backdrop-img size-full object-cover opacity-0 transition-opacity duration-700 data-loaded:opacity-60 data-failed:hidden motion-reduce:transition-none"
          />
        </div>
      )}
      <div className={`absolute inset-0 ${scrim}`} />
    </div>
  )
}

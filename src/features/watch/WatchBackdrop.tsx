import { useState, type SyntheticEvent } from 'react'
import { zoomStyle } from '../../components/media'
import { cropZoomOf } from '../../data/frameFlags'
import type { Video } from '../../types'
import { reelImages } from '../reel/stills'
import { useStageCentre } from './useStageCentre'
import './watch.css'

/**
 * The stage's poster (already loading, never a flagged frame) as a quiet, neutral still: shown
 * once loaded, falling back to the 320px thumbnail, and gone (paper) when neither loads. Black bars
 * baked into the still are zoomed out, as on the poster, so no grey bands edge it.
 */
function Still({ video, className }: { video: Video; className: string }) {
  const [images] = useState(() => reelImages(video))
  const [src, setSrc] = useState(images.poster ?? images.thumbnail)
  if (!src) return null
  // A missing poster falls back to the 320px thumbnail; failing that, the paper stays.
  const fail = () => setSrc(src === images.thumbnail ? null : images.thumbnail)
  // YouTube answers a missing still with a 120px placeholder.
  const onLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth > 120) e.currentTarget.dataset.loaded = ''
    else fail()
  }
  return (
    <div className={className} aria-hidden="true">
      <img
        src={src}
        alt=""
        decoding="async"
        onLoad={onLoad}
        onError={fail}
        style={zoomStyle(cropZoomOf(src))}
      />
    </div>
  )
}

/**
 * Full-bleed, blurred and dimmed still behind the player column, fading into the page. The page's
 * staging lives here too: the stage sits mid-viewport while the preview plays (useStageCentre).
 */
export default function WatchBackdrop({ video }: { video: Video }) {
  useStageCentre()
  return <Still video={video} className="watch-backdrop" />
}

/** Ambient light around the stage: the same still, blurred wide and neutral (watch.css). */
export function WatchAmbient({ video }: { video: Video }) {
  return <Still video={video} className="watch-ambient" />
}

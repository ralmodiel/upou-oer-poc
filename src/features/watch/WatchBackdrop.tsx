import { useState, type SyntheticEvent } from 'react'
import { zoomStyle } from '../../components/media'
import { cropZoomOf } from '../../data/frameFlags'
import type { Video } from '../../types'
import { reelImages } from '../reel/stills'
import './watch.css'

/**
 * Full-bleed, blurred and dimmed still behind the player column, fading into the page. It is the
 * stage's poster (already loading, never a flagged frame); without one the paper stays. Black bars
 * baked into the still are zoomed out of the band, as on the poster, so no grey bands edge it.
 */
export default function WatchBackdrop({ video }: { video: Video }) {
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
    <div className="watch-backdrop" aria-hidden="true">
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

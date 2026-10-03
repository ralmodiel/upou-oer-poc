import { useState, type SyntheticEvent } from 'react'
import type { Video } from '../../types'
import { reelImages } from '../reel/stills'
import './watch.css'

/**
 * Full-bleed, blurred and dimmed still behind the player column, fading into the page. It is the
 * stage's poster (already loading, never a flagged frame); without one the paper stays.
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
      <img src={src} alt="" decoding="async" onLoad={onLoad} onError={fail} />
    </div>
  )
}

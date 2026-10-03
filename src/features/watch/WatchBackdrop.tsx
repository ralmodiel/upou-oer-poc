import { useState, type SyntheticEvent } from 'react'
import { largeImageOf } from '../../components/media'
import type { Video } from '../../types'
import './watch.css'

const markLoaded = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.dataset.loaded = ''
}

/** Full-bleed, blurred and dimmed still behind the player column, fading into the page. */
export default function WatchBackdrop({ video }: { video: Video }) {
  const [src, setSrc] = useState(() => largeImageOf(video))
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <div className="watch-backdrop" aria-hidden="true">
      <img
        src={src}
        alt=""
        decoding="async"
        onLoad={markLoaded}
        // A missing large still falls back to the 320px thumbnail; failing that, the paper stays.
        onError={() => (src === video.thumbnail ? setFailed(true) : setSrc(video.thumbnail))}
      />
    </div>
  )
}

import { Link, type LinkProps } from 'react-router'
import { preloadReel } from '../features/reel/preload'
import type { Video } from '../types'

type Props = Omit<LinkProps, 'to'> & { video: Video }

// Warm only once the pointer, focus or finger rests for a moment, so sweeping the mouse
// across rows or scrolling with a finger on a card doesn't fetch every reel.
const INTENT_MS = 150
let pending = 0

function warmSoon(video: Video) {
  clearTimeout(pending)
  pending = window.setTimeout(() => preloadReel(video), INTENT_MS)
}

const cancelWarm = () => clearTimeout(pending)

/** Link to the player that warms the reel as soon as the user shows intent. */
export default function PlayLink({ video, ...props }: Props) {
  const warm = () => warmSoon(video)
  return (
    <Link
      to={`/watch/${encodeURIComponent(video.id)}`}
      onPointerEnter={warm}
      onPointerLeave={cancelWarm}
      onFocus={warm}
      onBlur={cancelWarm}
      onTouchStart={warm}
      onTouchMove={cancelWarm}
      {...props}
    />
  )
}

import { fromStart, useSavedPosition } from '../lib/storage'
import type { Video } from '../types'
import PlayLink from './PlayLink'
import { RestartIcon } from './icons'
import { buttonClass } from './ui/button-styles'

/**
 * "Play from start", for beside a Play button in an `@container` row: shown while this browser has
 * a saved place in the video (where Play resumes). A round icon on phones and in a row under 26rem
 * (or where `className` and `labelClassName` say), its label kept as its name.
 */
export default function PlayFromStart({
  video,
  className = 'max-sm:w-11 max-sm:px-0 @max-[26rem]:w-11 @max-[26rem]:px-0',
  labelClassName = 'max-sm:sr-only @max-[26rem]:sr-only',
}: {
  video: Video
  className?: string
  labelClassName?: string
}) {
  const saved = useSavedPosition(video.id)
  if (saved === undefined) return null
  return (
    <PlayLink
      video={video}
      state={fromStart(video.id, saved)}
      className={buttonClass('secondary', 'md', className)}
    >
      <RestartIcon />
      <span className={labelClassName}>Play from start</span>
    </PlayLink>
  )
}

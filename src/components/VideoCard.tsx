import { memo } from 'react'
import { formatDate } from '../lib/format'
import type { Video } from '../types'
import DetailsLink from './DetailsLink'
import MyListButton from './MyListButton'
import PlayLink from './PlayLink'
import Thumbnail from './Thumbnail'
import { InfoIcon, PlayIcon } from './icons'
import { isNew } from './media'
import Badge from './ui/Badge'

// Quick actions sit above the stretched link; they appear on hover/focus and stay visible on touch screens.
const ACTIONS =
  'relative z-20 -ml-2 flex items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 group-has-focus-visible/card:opacity-100 [@media(hover:none)]:opacity-100'
export const ACTION =
  'inline-flex h-9 items-center gap-1.5 rounded-pill px-2.5 text-xs font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-maroon aria-pressed:text-maroon [@media(hover:none)]:h-10'

interface Props {
  video: Video
  /** `sizes` for the thumbnail, matching the layout the card sits in. */
  sizes: string
  /** Title level, one below the heading of the list the card sits in. */
  heading?: 'h2' | 'h3' | 'h4'
  /** False takes the card out of the Tab order (roving tabindex in VideoGrid). */
  active?: boolean
  /** Hide the category eyebrow where the surrounding heading already names it. */
  showCategory?: boolean
}

function VideoCard({
  video,
  sizes,
  heading: Heading = 'h3',
  active = true,
  showCategory = true,
}: Props) {
  const { id, title } = video
  const tabIndex = active ? 0 : -1
  // DOM order: eyebrow, title link, media, meta, actions. CSS order puts the media first.
  return (
    <article className="group/card relative flex flex-col">
      {showCategory && <p className="eyebrow order-2 mt-3 truncate">{video.category}</p>}
      <Heading className="order-3 mt-1 line-clamp-2 text-base/snug font-semibold text-ink transition-colors duration-200 group-hover/card:text-maroon">
        {/* Stretched link: a click, tap or Enter anywhere on the card plays the video. */}
        <PlayLink
          video={video}
          aria-label={`Play ${title}`}
          tabIndex={tabIndex}
          data-card-link=""
          className="outline-none after:absolute after:inset-0 after:z-10 after:rounded-card"
        >
          {title}
        </PlayLink>
      </Heading>
      <Thumbnail
        video={video}
        sizes={sizes}
        className="order-1 rounded-card ring-1 ring-black/5 transition-[translate,box-shadow] duration-200 ease-out-soft group-hover/card:-translate-y-0.5 group-hover/card:shadow-lift group-has-[[data-card-link]:focus-visible]/card:ring-2 group-has-[[data-card-link]:focus-visible]/card:ring-maroon group-has-[[data-card-link]:focus-visible]/card:ring-offset-2 group-has-[[data-card-link]:focus-visible]/card:ring-offset-paper motion-reduce:transition-none"
      >
        {/* Visual cue only: the card link already plays. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 group-has-[[data-card-link]:focus-visible]/card:opacity-100"
        >
          <span className="grid size-11 place-items-center rounded-pill bg-surface/95 text-maroon shadow-lift">
            <PlayIcon className="size-5 translate-x-px" />
          </span>
        </span>
      </Thumbnail>
      <p className="order-4 mt-1 flex items-center gap-1.5 text-sm text-ink-3">
        <time dateTime={video.publishedAt}>{formatDate(video.publishedAt)}</time>
        {isNew(id) && (
          <>
            <span aria-hidden="true">·</span>
            <Badge tone="amber">New</Badge>
          </>
        )}
      </p>
      <div className={`order-5 mt-1 ${ACTIONS}`}>
        <MyListButton id={id} title={title} className={ACTION} tabIndex={tabIndex} />
        <DetailsLink
          id={id}
          aria-label={`Details: ${title}`}
          tabIndex={tabIndex}
          className={ACTION}
        >
          <InfoIcon className="size-4" />
          Details
        </DetailsLink>
      </div>
    </article>
  )
}

export default memo(VideoCard)

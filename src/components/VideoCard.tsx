import { memo, use } from 'react'
import { formatDate } from '../lib/format'
import type { Video } from '../types'
import DetailsLink from './DetailsLink'
import MyListButton from './MyListButton'
import PlayLink from './PlayLink'
import Thumbnail from './Thumbnail'
import { CardReasons } from './recs'
import { InfoIcon, PlayIcon } from './icons'
import { isNew } from './media'
import { useCardPreview } from './preview'
import Badge from './ui/Badge'

// Quick actions sit above the stretched link: quiet at rest, full strength while the card is
// hovered or focused, and always strong on touch screens.
const ACTIONS =
  'relative z-20 -ml-2 flex items-center gap-0.5 text-ink-3 transition-colors duration-200 group-hover/card:text-ink-2 group-focus-within/card:text-ink-2 [@media(hover:none)]:text-ink-2'
export const ACTION =
  'inline-flex h-10 items-center gap-1.5 rounded-pill px-2.5 text-xs font-semibold transition-colors duration-200 hover:bg-surface-2 hover:text-maroon aria-pressed:text-maroon'

// Instant maroon outline on the thumbnail while the card link has keyboard focus (outline is
// not in the transition list, unlike ring's box-shadow).
const FOCUS =
  'group-has-[[data-card-link]:focus-visible]/card:outline-2 group-has-[[data-card-link]:focus-visible]/card:outline-maroon group-has-[[data-card-link]:focus-visible]/card:outline-offset-2'

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
  const reasons = use(CardReasons)
  const reason = reasons?.get(id)
  const { hostProps, overlay, previewing } = useCardPreview(video)
  // DOM order: eyebrow, title link, media, meta, actions. CSS order puts the media first. Every
  // line has a fixed height (one-line eyebrow, two-line title; in a grid with reasons a two-line
  // reason slot, bottom-aligned), so cards in a row line up.
  return (
    <article {...hostProps} className="group/card relative flex flex-col">
      {reasons ? (
        <p
          className="order-2 mt-3 flex min-h-[2lh] items-end text-xs font-semibold text-forest"
          title={reason}
        >
          {reason ? (
            <span className="line-clamp-2">{reason}</span>
          ) : (
            <span className="eyebrow truncate">{video.category}</span>
          )}
        </p>
      ) : (
        showCategory && <p className="eyebrow order-2 mt-3 truncate">{video.category}</p>
      )}
      <Heading
        title={title}
        className="order-3 mt-1 line-clamp-2 min-h-[2lh] text-base/snug font-semibold text-ink transition-colors duration-200 group-hover/card:text-maroon"
      >
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
        className={`order-1 rounded-card ring-1 ring-black/5 transition-[translate,box-shadow] duration-200 ease-out-soft group-hover/card:-translate-y-0.5 group-hover/card:shadow-lift group-active/card:translate-y-0 motion-reduce:transition-none ${FOCUS}`}
      >
        {overlay}
        {/* Visual cue only: the card link already plays. Hidden while a preview runs. */}
        {!previewing && (
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 group-has-[[data-card-link]:focus-visible]/card:opacity-100"
          >
            <span className="grid size-11 place-items-center rounded-pill bg-surface/95 text-maroon shadow-lift">
              <PlayIcon className="size-5 translate-x-px" />
            </span>
          </span>
        )}
      </Thumbnail>
      <p className="order-4 mt-1 flex h-5 items-center gap-1.5 text-sm text-ink-3">
        <time dateTime={video.publishedAt}>{formatDate(video.publishedAt)}</time>
        {isNew(id) && (
          <>
            <span aria-hidden="true">·</span>
            <Badge tone="gold">New</Badge>
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

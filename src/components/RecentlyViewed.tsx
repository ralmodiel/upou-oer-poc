import { memo, useId } from 'react'
import type { Video } from '../types'
import Carousel, { CarouselDots } from './Carousel'
import { useCarousel } from './carousel-state'
import PlayLink from './PlayLink'
import Thumbnail from './Thumbnail'
import { useCardPreview } from './preview'
import { CARD_RING, ITEM_FOCUS, ITEM_LIFT, ManageLink, PlayBadge } from './browse-ui'
import { useReturnRow } from './hooks'
import SectionHeading from './ui/SectionHeading'

/** Compact row (Carousel) of videos opened lately; hidden until there are any. */
function RecentlyViewed({ videos }: { videos: readonly Video[] }) {
  const headingId = useId()
  const carousel = useCarousel(videos.length, useReturnRow() === 'recent')
  if (!videos.length) return null
  return (
    <section aria-labelledby={headingId} className="px-(--gutter) py-8 sm:py-10">
      <SectionHeading
        id={headingId}
        title="Recently viewed"
        description="Videos you opened lately, newest first. Only this browser keeps the list."
      >
        <CarouselDots carousel={carousel} />
        <ManageLink>Manage history</ManageLink>
      </SectionHeading>
      <div className="mt-5">
        <Carousel carousel={carousel} label="Recently viewed" className="row-compact">
          <ul role="list" data-row="recent" className="flex w-max gap-4">
            {videos.map((video) => (
              <li key={video.id} className="w-(--row-card) flex-none snap-start">
                <Item video={video} />
              </li>
            ))}
          </ul>
        </Carousel>
      </div>
    </section>
  )
}

// A compact card: the image, eyebrow and title of a VideoCard, with its hover and focus.
function Item({ video }: { video: Video }) {
  const { hostProps, overlay, previewing } = useCardPreview(video)
  return (
    <article {...hostProps} className="group/item relative">
      <Thumbnail
        video={video}
        sizes="224px"
        className={`rounded-card ${CARD_RING} ${ITEM_LIFT} ${ITEM_FOCUS}`}
      >
        {overlay}
        {!previewing && <PlayBadge item />}
      </Thumbnail>
      <p className="eyebrow mt-3 truncate">{video.category}</p>
      <h3
        title={video.title}
        className="mt-1 line-clamp-2 min-h-[2lh] text-sm/snug font-semibold text-ink transition-colors group-hover/item:text-maroon"
      >
        <PlayLink
          video={video}
          aria-label={`Play ${video.title}`}
          data-card-link=""
          className="outline-none after:absolute after:inset-0"
        >
          {video.title}
        </PlayLink>
      </h3>
    </article>
  )
}

export default memo(RecentlyViewed)

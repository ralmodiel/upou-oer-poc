import { memo, useId } from 'react'
import type { CategoryRow } from '../data/catalog'
import Carousel, { CarouselDots } from './Carousel'
import { FIRST_ITEMS, useCarousel } from './carousel-state'
import VideoGrid from './VideoGrid'
import { useNear } from './browse-hooks'
import { RowSkeleton } from './browse-ui'
import { toneOf } from './tones'
import SectionHeading from './ui/SectionHeading'

interface Props {
  row: CategoryRow
  /** Render the cards at once (Back, reload) instead of when the section nears the viewport. */
  eager?: boolean
}

// Cards render once the section is within two screens of the viewport.
const NEAR = '200% 0px'

/**
 * One home section: a collection heading, a "See all" link and a row of its newest videos that
 * scrolls sideways (Carousel), ending on a "See all" tile. Until it nears the viewport, a skeleton
 * of the same size stands in.
 */
function Section({ row, eager = true }: Props) {
  const headingId = useId()
  const [ref, near] = useNear<HTMLElement>(eager, NEAR)
  const to = `/collections/${row.slug}`
  const carousel = useCarousel(near ? row.videos.length + 1 : 0)
  // The first page at once, the rest of the row (and its See all tile) when the row is used or idle.
  const rest = !carousel.full && row.videos.length + 1 > FIRST_ITEMS
  return (
    <section
      ref={ref}
      aria-labelledby={headingId}
      className="lazy-section px-(--gutter) py-8 sm:py-10"
    >
      <SectionHeading
        id={headingId}
        title={row.title}
        count={row.count}
        seeAllTo={to}
        seeAllContext={row.title}
      >
        <CarouselDots carousel={carousel} />
      </SectionHeading>
      <div className="mt-5">
        {near ? (
          <Carousel carousel={carousel} label={row.title}>
            <VideoGrid
              videos={rest ? row.videos.slice(0, FIRST_ITEMS) : row.videos}
              layout="row"
              first={carousel.first}
              seeAll={
                rest
                  ? undefined
                  : { to, count: row.count, title: row.title, tone: toneOf(row.slug) }
              }
            />
          </Carousel>
        ) : (
          <RowSkeleton count={Math.min(row.videos.length + 1, 5)} eyebrow={false} />
        )}
      </div>
    </section>
  )
}

export default memo(Section)

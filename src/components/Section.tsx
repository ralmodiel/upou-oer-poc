import { memo, useId } from 'react'
import type { CategoryRow } from '../data/catalog'
import Carousel, { CarouselDots } from './Carousel'
import { FIRST_ITEMS, useCarousel } from './carousel-state'
import VideoGrid from './VideoGrid'
import { useNear } from './browse-hooks'
import { useReturnRow } from './hooks'
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
 * scrolls sideways (Carousel), ending on a "See all" tile when the collection holds more. Until it
 * nears the viewport, a skeleton of the same size stands in.
 */
function Section({ row, eager = true }: Props) {
  const headingId = useId()
  const [ref, near] = useNear<HTMLElement>(eager, NEAR)
  const to = `/collections/${row.slug}`
  // A See all tile ends the row only when the collection holds more than the row shows.
  const more = row.count > row.videos.length
  const items = row.videos.length + (more ? 1 : 0)
  // The row Back returns to renders whole at once, so its card is there to take focus.
  const carousel = useCarousel(near ? items : 0, useReturnRow() === row.id)
  // The first page at once, the rest of the row (and its See all tile) once the row is used.
  const rest = !carousel.full && items > FIRST_ITEMS
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
              row={row.id}
              first={carousel.first}
              seeAll={
                rest || !more
                  ? undefined
                  : { to, count: row.count, title: row.title, tone: toneOf(row.slug) }
              }
            />
          </Carousel>
        ) : (
          <RowSkeleton count={Math.min(items, FIRST_ITEMS)} eyebrow={false} />
        )}
      </div>
    </section>
  )
}

export default memo(Section)

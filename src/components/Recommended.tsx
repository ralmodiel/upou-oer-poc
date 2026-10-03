import { memo, useId, type ReactNode } from 'react'
import type { Video } from '../types'
import Carousel, { CarouselDots } from './Carousel'
import { FIRST_ITEMS, useCarousel } from './carousel-state'
import VideoGrid from './VideoGrid'
import { RowSkeleton } from './browse-ui'
import { useReturnRow } from './hooks'
import { CardReasons } from './recs'
import SectionHeading from './ui/SectionHeading'

interface Props {
  /** The row's id for Back (data-row): "recommended", "because". */
  row: string
  title: string
  description?: ReactNode
  videos: readonly Video[]
  /** Why each video is here, by id; shown as the card eyebrow. */
  reasons?: ReadonlyMap<string, string>
  /** Still computing: keep the space with a skeleton row. */
  pending?: boolean
  /** Cards the row will hold (sizes the skeleton). */
  cards: number
}

/** A personalised home row ("Recommended for you", "Because you watched …"), one Carousel. */
function Recommended({ row, title, description, videos, reasons, pending, cards }: Props) {
  const headingId = useId()
  const carousel = useCarousel(pending ? 0 : videos.length, useReturnRow() === row)
  if (!pending && !videos.length) return null
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={pending || undefined}
      className="px-(--gutter) py-8 sm:py-10"
    >
      <SectionHeading id={headingId} title={title} description={description}>
        <CarouselDots carousel={carousel} />
      </SectionHeading>
      <div className="mt-5">
        {pending ? (
          <RowSkeleton count={Math.min(cards, 5)} reasons />
        ) : (
          <CardReasons value={reasons ?? null}>
            <Carousel carousel={carousel} label={title}>
              <VideoGrid
                videos={carousel.full ? videos : videos.slice(0, FIRST_ITEMS)}
                layout="row"
                row={row}
                first={carousel.first}
                showCategory
              />
            </Carousel>
          </CardReasons>
        )}
      </div>
    </section>
  )
}

export default memo(Recommended)

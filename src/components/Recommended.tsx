import { memo, useId, type ReactNode } from 'react'
import type { Video } from '../types'
import VideoGrid from './VideoGrid'
import { GridSkeleton } from './browse-ui'
import { CardReasons } from './recs'
import SectionHeading from './ui/SectionHeading'

interface Props {
  title: ReactNode
  description?: ReactNode
  videos: readonly Video[]
  /** Why each video is here, by id; shown as the card eyebrow. */
  reasons?: ReadonlyMap<string, string>
  /** Still computing: keep the space with a skeleton grid of `cards` items. */
  pending?: boolean
  cards: number
}

/** A personalised home section ("Recommended for you", "Because you watched …"). */
function Recommended({ title, description, videos, reasons, pending, cards }: Props) {
  const headingId = useId()
  if (!pending && !videos.length) return null
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={pending || undefined}
      className="border-t border-line px-(--gutter) pt-6 pb-10"
    >
      <SectionHeading id={headingId} title={title} description={description} />
      <div className="mt-5">
        {pending ? (
          <GridSkeleton count={cards} />
        ) : (
          <CardReasons value={reasons ?? null}>
            <VideoGrid videos={videos} layout="section" showCategory />
          </CardReasons>
        )}
      </div>
    </section>
  )
}

export default memo(Recommended)

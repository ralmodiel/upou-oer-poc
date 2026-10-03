import { memo, useId } from 'react'
import type { CategoryRow } from '../data/catalog'
import VideoGrid from './VideoGrid'
import SectionHeading from './ui/SectionHeading'

interface Props {
  row: CategoryRow
  /** Show only the first `limit` videos (phones). */
  limit?: number
}

/** One home section: a category heading, a "See all" link and a capped grid of its newest videos. */
function Section({ row, limit }: Props) {
  const headingId = useId()
  const videos = limit ? row.videos.slice(0, limit) : row.videos
  return (
    <section
      aria-labelledby={headingId}
      className={`lazy-section px-(--gutter) py-8 sm:py-10 ${
        videos.length <= 4 ? 'lazy-section-short' : ''
      }`}
    >
      <SectionHeading
        id={headingId}
        title={row.title}
        count={row.count}
        seeAllTo={`/collections/${row.slug}`}
        seeAllContext={row.title}
      />
      <div className="mt-5">
        <VideoGrid videos={videos} layout="section" />
      </div>
    </section>
  )
}

export default memo(Section)

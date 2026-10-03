import { memo, useId } from 'react'
import type { CategoryRow } from '../data/catalog'
import VideoGrid from './VideoGrid'
import SectionHeading from './ui/SectionHeading'

/** One home section: a category heading, a "See all" link and a capped grid of its newest videos. */
function Section({ row }: { row: CategoryRow }) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className="lazy-section border-t border-line px-(--gutter) pt-6 pb-10"
    >
      <SectionHeading
        id={headingId}
        title={row.title}
        count={row.count}
        seeAllTo={`/collections/${row.slug}`}
        seeAllContext={row.title}
      />
      <div className="mt-5">
        <VideoGrid videos={row.videos} layout="section" />
      </div>
    </section>
  )
}

export default memo(Section)

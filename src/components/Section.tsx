import { memo, useId } from 'react'
import type { CategoryRow } from '../data/catalog'
import VideoGrid from './VideoGrid'
import { useNear } from './browse-hooks'
import { GridSkeleton } from './browse-ui'
import SectionHeading from './ui/SectionHeading'

interface Props {
  row: CategoryRow
  /** Render the cards at once (Back, reload) instead of when the section nears the viewport. */
  eager?: boolean
}

// Cards render once the section is within two screens of the viewport.
const NEAR = '200% 0px'

/**
 * One home section: a category heading, a "See all" link and one row of its newest videos (two
 * rows of two on phones). Until it nears the viewport, a skeleton of the same size stands in.
 */
function Section({ row, eager = true }: Props) {
  const headingId = useId()
  const [ref, near] = useNear<HTMLElement>(eager, NEAR)
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
        seeAllTo={`/collections/${row.slug}`}
        seeAllContext={row.title}
      />
      <div className="mt-5">
        {near ? (
          <VideoGrid videos={row.videos} layout="section" />
        ) : (
          <GridSkeleton count={row.videos.length} eyebrow={false} />
        )}
      </div>
    </section>
  )
}

export default memo(Section)

import { memo, startTransition, useEffect, useId, useRef, useState } from 'react'
import type { CategoryRow } from '../data/catalog'
import VideoGrid from './VideoGrid'
import { GridSkeleton } from './browse-ui'
import SectionHeading from './ui/SectionHeading'

interface Props {
  row: CategoryRow
  /** Show only the first `limit` videos (phones). */
  limit?: number
  /** Render the cards at once (Back, reload) instead of when the section nears the viewport. */
  eager?: boolean
}

// Cards render once the section is within two screens of the viewport.
const NEAR = '200% 0px'

function useNear(eager: boolean) {
  const ref = useRef<HTMLElement>(null)
  const [near, setNear] = useState(eager)
  useEffect(() => {
    const el = ref.current
    if (near || !el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) startTransition(() => setNear(true))
      },
      { rootMargin: NEAR },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [near])
  return [ref, near] as const
}

/**
 * One home section: a category heading, a "See all" link and a capped grid of its newest videos.
 * Until it nears the viewport, a skeleton grid of the same size stands in for the cards.
 */
function Section({ row, limit, eager = true }: Props) {
  const headingId = useId()
  const [ref, near] = useNear(eager)
  const videos = limit ? row.videos.slice(0, limit) : row.videos
  return (
    <section
      ref={ref}
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
        {near ? (
          <VideoGrid videos={videos} layout="section" />
        ) : (
          <GridSkeleton count={videos.length} eyebrow={false} />
        )}
      </div>
    </section>
  )
}

export default memo(Section)

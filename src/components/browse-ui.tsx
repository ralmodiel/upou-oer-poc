import { Fragment } from 'react'
import { Link } from 'react-router'
import { factsOf } from '../data/catalog'
import type { Video } from '../types'
import Skeleton from './ui/Skeleton'

export const TEXT_LINK = 'font-semibold text-maroon underline-offset-4 hover:underline'

/** Titles longer than this get a smaller display size in the hero and the quick look. */
export const LONG_TITLE = 120

/** Screen-reader note for pages with video grids or chip rows (one per page). */
export function GridHint() {
  return (
    <p className="sr-only">
      In video grids and chip rows, the arrow keys move between items; Tab moves on.
    </p>
  )
}

/** "Published Nov 25, 2024 · Health Sciences (165 videos) · UP Open University", collection linked. */
export function FactsLine({ video, className = '' }: { video: Video; className?: string }) {
  // Inline text (not flex items), so the separators keep their spaces for assistive tech.
  return (
    <p className={`text-sm/relaxed text-ink-2 ${className}`}>
      {factsOf(video).map((fact, i) => (
        <Fragment key={fact.label}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          {fact.to ? (
            <Link
              to={fact.to}
              className="-my-2.5 inline-block py-2.5 font-semibold text-ink underline-offset-4 hover:text-maroon hover:underline"
            >
              {fact.label}
            </Link>
          ) : fact.dateTime ? (
            <time dateTime={fact.dateTime}>{fact.label}</time>
          ) : (
            <span>{fact.label}</span>
          )}
        </Fragment>
      ))}
    </p>
  )
}

/** Placeholder with the geometry of a section grid, shown while recommendations compute. */
export function GridSkeleton({ count }: { count: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-video w-full" rounded="card" />
          <Skeleton className="mt-3 h-3 w-1/3" />
          <Skeleton className="mt-2 h-4 w-11/12" />
          <Skeleton className="mt-1.5 h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/4" />
        </div>
      ))}
    </div>
  )
}

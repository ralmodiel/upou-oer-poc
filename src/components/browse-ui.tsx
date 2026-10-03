import { Link, type To } from 'react-router'
import { ChevronRightIcon } from './icons'

export const TEXT_LINK = 'font-semibold text-maroon underline-offset-4 hover:underline'

interface SeeAllProps {
  to: To
  count: number
  /** Section name, read by screen readers so every "See all" link has a distinct name. */
  context: string
}

/** "See all (n)" link styled like SectionHeading's, with the section name for assistive tech. */
export function SeeAllLink({ to, count, context }: SeeAllProps) {
  return (
    <Link
      to={to}
      className="group inline-flex h-10 items-center gap-0.5 text-sm font-semibold text-maroon hover:text-maroon-2"
    >
      <span aria-hidden="true">See all ({count})</span>
      <span className="sr-only">
        See all ({count}) in {context}
      </span>
      <ChevronRightIcon className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
    </Link>
  )
}

/** Screen-reader note for pages with video grids (one per page). */
export function GridHint() {
  return <p className="sr-only">In video grids, the arrow keys move between videos.</p>
}

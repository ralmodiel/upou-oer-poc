import { Fragment } from 'react'
import { openPrivacy } from '../lib/privacy'
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

/**
 * "Published Nov 25, 2024 · Health Sciences (165 videos) · UP Open University", collection linked.
 * `passOver`: remote ↑ / ↓ from outside the section skip the link (the hero: ↓ from the header lands
 * on Play).
 */
export function FactsLine({
  video,
  className = '',
  passOver = false,
}: {
  video: Video
  className?: string
  passOver?: boolean
}) {
  // Inline text (not flex items), so the separators keep their spaces for assistive tech.
  return (
    <p className={`text-sm/relaxed text-ink-2 ${className}`}>
      {factsOf(video).map((fact, i) => (
        <Fragment key={fact.label}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          {fact.to ? (
            <Link
              to={fact.to}
              data-spatial={passOver ? 'heading' : undefined}
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

/**
 * Placeholder with the geometry of a section grid (card for card), shown while recommendations
 * compute and for home sections not yet near the viewport; `reasons` gives each card the two-line
 * reason slot, `eyebrow={false}` drops the eyebrow line (category sections).
 */
export function GridSkeleton({
  count,
  reasons = false,
  eyebrow = true,
}: {
  count: number
  reasons?: boolean
  eyebrow?: boolean
}) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-video w-full" rounded="card" />
          {/* Eyebrow, two title lines, date, actions: the line heights of VideoCard. */}
          {eyebrow && (
            <div className={`mt-3 flex ${reasons ? 'h-8 items-end pb-0.5' : 'h-4 items-center'}`}>
              <Skeleton className={`h-3 ${reasons ? 'w-3/4' : 'w-1/3'}`} />
            </div>
          )}
          <div className="mt-1 flex h-11 flex-col justify-center gap-1.5">
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="mt-1 flex h-5 items-center">
            <Skeleton className="h-3 w-1/4" />
          </div>
          <div className="mt-1 flex h-10 items-center gap-4">
            <Skeleton className="h-4 w-12" rounded="pill" />
            <Skeleton className="h-4 w-16" rounded="pill" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Opens the Privacy and history panel (history and personalization switches). */
export function ManageLink({ children = 'Privacy settings' }: { children?: string }) {
  return (
    <button
      type="button"
      onClick={openPrivacy}
      className={`${TEXT_LINK} inline-flex min-h-10 items-center`}
    >
      {children}
    </button>
  )
}

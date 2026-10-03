import { Fragment } from 'react'
import { openPrivacy } from '../lib/privacy'
import { Link } from 'react-router'
import { factsOf } from '../data/catalog'
import type { Video } from '../types'
import { ChevronRightIcon } from './icons'
import { MARK, type Tone } from './tones'
import Skeleton from './ui/Skeleton'

export const TEXT_LINK = 'font-semibold text-maroon underline-offset-4 hover:underline'

/** Titles longer than this get a smaller display size in the hero and the quick look. */
export const LONG_TITLE = 120

/** Screen-reader note for pages with video rows, grids or chip rows (one per page). */
export function GridHint() {
  return (
    <p className="sr-only">
      In video rows, grids and chip rows, the arrow keys move between items; Tab moves on.
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
 * Placeholder with the geometry of a home row (Carousel), card for card, shown while
 * recommendations compute and for home sections not yet near the viewport; `count` covers the first
 * page and the card peeking after it. `reasons` gives each card the two-line reason slot,
 * `eyebrow={false}` drops the eyebrow line (collection rows).
 */
export function RowSkeleton({
  count,
  reasons = false,
  eyebrow = true,
}: {
  count: number
  reasons?: boolean
  eyebrow?: boolean
}) {
  return (
    <div aria-hidden="true" className="row">
      <div className="row-track row-still">
        <div className="flex w-max gap-4">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="w-(--row-card) flex-none">
              <Skeleton className="aspect-video w-full" rounded="card" />
              {/* Eyebrow, two title lines, date, actions: the line heights of VideoCard. */}
              {eyebrow && (
                <div
                  className={`mt-3 flex ${reasons ? 'h-8 items-end pb-0.5' : 'h-4 items-center'}`}
                >
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
      </div>
    </div>
  )
}

export interface SeeAll {
  to: string
  count: number
  /** The collection's name, in the tile's accessible name ("See all 120 videos in Research"). */
  title: string
  tone: Tone
}

/**
 * The end of a home row: the whole collection, in a tile the size of a card's image, under the
 * collection's colour bar. Hover and focus as on cards.
 */
export function SeeAllTile({ to, count, title, tone, tabIndex }: SeeAll & { tabIndex?: number }) {
  return (
    <Link
      to={to}
      tabIndex={tabIndex}
      aria-label={`See all ${count.toLocaleString('en')} videos in ${title}`}
      className="group/all relative block aspect-video overflow-hidden rounded-card border border-line bg-surface transition-[translate,scale,box-shadow] duration-200 ease-out-soft @container hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus active:translate-y-0 motion-safe:focus-visible:scale-102 motion-reduce:transition-none"
    >
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 ${MARK[tone]}`} />
      <span className="flex size-full flex-col justify-end p-[7cqi]">
        <span className="font-display text-[length:clamp(1.125rem,11cqi,2rem)] leading-tight text-ink transition-colors group-hover/all:text-maroon">
          See all
        </span>
        <span className="mt-[2cqi] flex items-center justify-between gap-2 text-sm text-ink-2">
          <span>{count.toLocaleString('en')} videos</span>
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-pill border border-line text-ink transition-transform motion-safe:group-hover/all:translate-x-0.5"
          >
            <ChevronRightIcon className="size-4" />
          </span>
        </span>
      </span>
    </Link>
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

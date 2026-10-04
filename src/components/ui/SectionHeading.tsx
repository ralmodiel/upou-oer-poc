// SectionHeading: `title` rendered `as` h1|h2|h3 (default h2, h1 uses the page-title scale) under a
// short gold rule (`rule={false}` drops it), optional `eyebrow`, `count`, a "See all (n)" link via `seeAllTo` (+ `seeAllLabel`; `seeAllContext` names the
// section for assistive tech so repeated links stay distinct), `description`, and `children` for
// controls on the right. Remote arrows from other sections pass over the link (lib/spatial.ts).
import type { ReactNode } from 'react'
import { Link, type To } from 'react-router'
import { ChevronRightIcon } from '../icons'

export interface SectionHeadingProps {
  title: ReactNode
  as?: 'h1' | 'h2' | 'h3'
  id?: string
  eyebrow?: ReactNode
  count?: number
  seeAllTo?: To
  seeAllLabel?: string
  seeAllContext?: string
  description?: ReactNode
  children?: ReactNode
  rule?: boolean
  className?: string
  /** -1 makes the title a focus target (search results after a submit); no ring, it is no control. */
  tabIndex?: number
}

const TITLE: Record<'h1' | 'h2' | 'h3', string> = {
  h1: 'font-display text-title text-ink',
  h2: 'font-display text-2xl leading-tight tracking-tight text-ink sm:text-3xl',
  h3: 'font-display text-xl leading-tight tracking-tight text-ink sm:text-2xl',
}

export default function SectionHeading({
  title,
  as: Tag = 'h2',
  id,
  eyebrow,
  count,
  seeAllTo,
  seeAllLabel,
  seeAllContext,
  description,
  children,
  rule = true,
  className = '',
  tabIndex,
}: SectionHeadingProps) {
  const showCountInline = count !== undefined && !seeAllTo
  const seeAll = seeAllLabel ?? (count !== undefined ? `See all (${count})` : 'See all')
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-2 ${className}`}>
      <div className="min-w-0">
        {rule && (
          <span
            aria-hidden="true"
            className="mb-3 block h-1 w-10 rounded-pill bg-band-gold bg-linear-to-r from-band-gold to-amber shadow-[0_0_10px_-1px_var(--color-band-gold)] dark:shadow-[0_0_12px_0_var(--color-band-gold)]"
          />
        )}
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <Tag
          id={id}
          tabIndex={tabIndex}
          className={tabIndex === undefined ? TITLE[Tag] : `${TITLE[Tag]} outline-none`}
        >
          {title}
          {showCountInline && (
            <span className="ml-2.5 font-sans text-base font-normal text-ink-3 tabular-nums">
              {count}
            </span>
          )}
        </Tag>
        {description && <p className="mt-1.5 max-w-prose text-sm text-ink-2">{description}</p>}
      </div>
      {(children || seeAllTo) && (
        <div className="flex items-center gap-3">
          {children}
          {seeAllTo && (
            <Link
              to={seeAllTo}
              data-spatial="heading"
              // Hover and focus: a frosted pill behind the text (wider than the link, so nothing
              // moves) that carries the focus ring.
              className="group/all relative isolate inline-flex h-10 items-center gap-0.5 rounded-pill text-sm font-semibold text-maroon outline-none transition-colors before:absolute before:inset-y-1 before:-inset-x-2.5 before:-z-10 before:rounded-pill before:bg-frost-2 before:opacity-0 before:shadow-(--shadow-glass) before:transition-opacity hover:text-maroon-2 hover:before:opacity-100 focus-visible:before:opacity-100 focus-visible:before:shadow-glow focus-visible:before:outline-2 focus-visible:before:outline-offset-2 focus-visible:before:outline-focus focus-visible:before:transition-none"
            >
              {/* Visible text first, then the section name: repeated links stay distinct. */}
              {seeAllContext ? `${seeAll} ` : seeAll}
              {seeAllContext && <span className="sr-only">in {seeAllContext}</span>}
              <ChevronRightIcon className="size-4 transition-transform motion-safe:group-hover/all:translate-x-0.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// SectionHeading: `title` rendered `as` h1|h2|h3 (default h2, h1 uses the page-title scale), optional
// `eyebrow`, `count`, a "See all (n)" link via `seeAllTo` (+ `seeAllLabel`; `seeAllContext` names the
// section for assistive tech so repeated links stay distinct), `description`, and `children` for
// controls on the right.
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
  className?: string
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
  className = '',
}: SectionHeadingProps) {
  const showCountInline = count !== undefined && !seeAllTo
  const seeAll = seeAllLabel ?? (count !== undefined ? `See all (${count})` : 'See all')
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-2 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <Tag id={id} className={TITLE[Tag]}>
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
              className="group inline-flex h-10 items-center gap-0.5 text-sm font-semibold text-maroon hover:text-maroon-2"
            >
              {/* Visible text first, then the section name: repeated links stay distinct. */}
              {seeAllContext ? `${seeAll} ` : seeAll}
              {seeAllContext && <span className="sr-only">in {seeAllContext}</span>}
              <ChevronRightIcon className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// Chip: pill-shaped filter / tag. With `to` it is a link (route-active by default, or pass `active`
// for query-string filters → aria-current); without `to` it is a toggle button (`active` →
// aria-pressed). Optional trailing `count`.
import type { MouseEventHandler, ReactNode } from 'react'
import { Link, NavLink, type To } from 'react-router'

export interface ChipProps {
  children: ReactNode
  to?: To
  end?: boolean
  active?: boolean
  count?: number
  onClick?: MouseEventHandler<HTMLElement>
  title?: string
  className?: string
}

// Single line, sized to its label (so items in a scroll row keep their width), clamped to the
// viewport with an ellipsis for the rare over-long label.
const BASE =
  'inline-flex h-10 w-max max-w-[calc(100vw-2*var(--gutter))] shrink-0 cursor-pointer items-center gap-1.5 rounded-pill border px-4 text-sm font-medium whitespace-nowrap transition-colors'
const OFF = 'border-line bg-surface text-ink-2 hover:border-ink-3 hover:bg-surface-2 hover:text-ink'
const ON = 'border-maroon/30 bg-maroon-soft text-maroon'

const chipClass = (active: boolean, extra: string) => `${BASE} ${active ? ON : OFF} ${extra}`.trim()

export default function Chip({
  children,
  to,
  end,
  active,
  count,
  onClick,
  title,
  className = '',
}: ChipProps) {
  const content = (
    <>
      <span className="truncate">{children}</span>
      {count !== undefined && <span className="shrink-0 text-xs tabular-nums">{count}</span>}
    </>
  )
  if (to !== undefined && active === undefined) {
    return (
      <NavLink
        to={to}
        end={end}
        onClick={onClick}
        title={title}
        className={({ isActive }) => chipClass(isActive, className)}
      >
        {content}
      </NavLink>
    )
  }
  const on = active === true
  if (to !== undefined) {
    return (
      <Link
        to={to}
        onClick={onClick}
        title={title}
        aria-current={on ? 'true' : undefined}
        className={chipClass(on, className)}
      >
        {content}
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={chipClass(on, className)}
    >
      {content}
    </button>
  )
}

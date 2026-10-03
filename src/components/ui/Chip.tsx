// Chip: pill-shaped filter / tag. With `to` it is a link (route-active by default, or pass `active`
// for query-string filters → aria-current); without `to` it is a toggle button (`active` →
// aria-pressed). Optional leading colour `dot` (a bg class), trailing `count`, `size` md|sm, `tabIndex`
// for roving rows. Inside a
// list, an over-long label truncates at the row (index.css caps the item via data-chip).
import type { MouseEventHandler, ReactNode } from 'react'
import { Link, NavLink, type To } from 'react-router'

export interface ChipProps {
  children: ReactNode
  to?: To
  end?: boolean
  active?: boolean
  count?: number
  /** Background class of a small leading dot (a collection's brand colour). */
  dot?: string
  size?: 'md' | 'sm'
  tabIndex?: number
  onClick?: MouseEventHandler<HTMLElement>
  title?: string
  className?: string
}

// Single line, sized to its label (so items in a scroll row keep their width), capped at the
// container with an ellipsis for the rare over-long label.
const BASE =
  'inline-flex w-max max-w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-pill border font-medium whitespace-nowrap transition-[background-color,color,border-color,translate] motion-safe:active:translate-y-px'
const SIZE = {
  md: 'h-10 px-4 text-sm',
  // Compact tags; still 40px tall on touch screens.
  sm: 'h-9 px-3 text-xs [@media(hover:none)]:h-10',
}
const OFF = 'border-line bg-surface text-ink-2 hover:border-ink-3 hover:bg-surface-2 hover:text-ink'
const ON = 'border-maroon/30 bg-maroon-soft text-maroon'

const chipClass = (active: boolean, size: 'md' | 'sm', extra: string) =>
  `${BASE} ${SIZE[size]} ${active ? ON : OFF} ${extra}`.trim()

export default function Chip({
  children,
  to,
  end,
  active,
  count,
  dot,
  size = 'md',
  tabIndex,
  onClick,
  title,
  className = '',
}: ChipProps) {
  const content = (
    <>
      {dot && <span aria-hidden="true" className={`size-2 shrink-0 rounded-pill ${dot}`} />}
      <span className="truncate">{children}</span>
      {count !== undefined && <span className="shrink-0 text-xs tabular-nums">{count}</span>}
    </>
  )
  // "Research (3)" rather than "Research3". (No sr-only spans here: they are absolutely positioned
  // and would stretch the page from inside a scroll row.)
  const label =
    count !== undefined && typeof children === 'string' ? `${children} (${count})` : undefined
  if (to !== undefined && active === undefined) {
    return (
      <NavLink
        to={to}
        end={end}
        onClick={onClick}
        title={title}
        tabIndex={tabIndex}
        aria-label={label}
        data-chip=""
        className={({ isActive }) => chipClass(isActive, size, className)}
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
        tabIndex={tabIndex}
        aria-label={label}
        data-chip=""
        aria-current={on ? 'true' : undefined}
        className={chipClass(on, size, className)}
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
      tabIndex={tabIndex}
      aria-label={label}
      data-chip=""
      aria-pressed={on}
      className={chipClass(on, size, className)}
    >
      {content}
    </button>
  )
}

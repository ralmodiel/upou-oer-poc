// Breadcrumbs: `items` [{ label, to? }] rendered as an ordered trail (Browse › Collection › Title);
// the last item is the current page (aria-current="page") and is never a link. `nowrap` keeps the
// trail on one line: the first crumb keeps its width, middle ones take at most 45% (truncated) and
// the current page's crumb truncates in what is left, so it never collapses to nothing.
import { Link, type To } from 'react-router'
import { ChevronRightIcon } from '../icons'

export interface Crumb {
  label: string
  to?: To
}

export interface BreadcrumbsProps {
  items: Crumb[]
  nowrap?: boolean
  className?: string
}

export default function Breadcrumbs({ items, nowrap = false, className = '' }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={`text-sm ${className}`}>
      <ol className={`flex items-center gap-x-1 ${nowrap ? 'flex-nowrap' : 'flex-wrap gap-y-1'}`}>
        {items.map((item, i) => {
          const last = i === items.length - 1
          const fit = !nowrap ? '' : last ? 'shrink-[1000]' : i === 0 ? 'shrink-0' : 'max-w-[45%]'
          return (
            <li key={`${item.label}-${i}`} className={`flex min-w-0 items-center gap-x-1 ${fit}`}>
              {item.to !== undefined && !last ? (
                // The 40px link keeps its box; a frosted pill inside it (wider by its negative
                // margins, so the text stays put) shows hover and carries the focus ring.
                <Link
                  to={item.to}
                  className="group/crumb -my-1.5 flex min-w-0 px-0.5 py-2.5 text-ink-2 outline-none hover:text-maroon focus-visible:text-maroon"
                >
                  <span className="-mx-2 -my-1 block truncate rounded-pill px-2 py-1 transition-[background-color,box-shadow] group-hover/crumb:bg-frost-2 group-hover/crumb:shadow-(--shadow-glass) group-focus-visible/crumb:bg-frost-2 group-focus-visible/crumb:shadow-glow group-focus-visible/crumb:outline-2 group-focus-visible/crumb:outline-offset-2 group-focus-visible/crumb:outline-focus">
                    {item.label}
                  </span>
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={`truncate px-0.5 py-1 ${last ? 'text-ink' : 'text-ink-2'}`}
                >
                  {item.label}
                </span>
              )}
              {/* After its crumb, so a wrapped trail never starts a line with a separator. */}
              {!last && <ChevronRightIcon className="size-3.5 shrink-0 text-ink-3" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// Breadcrumbs: `items` [{ label, to? }] rendered as an ordered trail (Browse › Collection › Title);
// the last item is the current page (aria-current="page") and is never a link. `nowrap` keeps the
// trail on one line: the current page's crumb truncates first, the others only after it.
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
          return (
            <li
              key={`${item.label}-${i}`}
              className={`flex min-w-0 items-center gap-x-1 ${nowrap && last ? 'shrink-[1000]' : ''}`}
            >
              {i > 0 && <ChevronRightIcon className="size-3.5 shrink-0 text-ink-3" />}
              {item.to !== undefined && !last ? (
                <Link
                  to={item.to}
                  className="-my-1.5 truncate rounded-sm px-0.5 py-2.5 text-ink-2 underline-offset-4 hover:text-maroon hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={`truncate px-0.5 py-1 ${last ? 'text-ink' : 'text-ink-2'}`}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

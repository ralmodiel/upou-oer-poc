import { Link } from 'react-router'
import SectionHeading from '../../components/ui/SectionHeading'
import { DEFAULT_CHANNEL } from '../../data/expand'
import { formatDate } from '../../lib/format'
import type { Video } from '../../types'

/** Compact list of similar videos; each row is one link, so it is keyboard operable as is. */
export default function UpNext({ items }: { items: readonly Video[] }) {
  if (!items.length) return null
  return (
    <section>
      <SectionHeading title="Up next" id="up-next-heading" />
      <ol
        aria-labelledby="up-next-heading"
        className="mt-3 divide-y divide-line border-y border-line"
      >
        {items.map((v) => (
          <li key={v.id}>
            <Link
              to={`/watch/${v.id}`}
              className="group -mx-2 flex gap-3 rounded-card px-2 py-3 outline-none transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
            >
              <img
                src={v.thumbnail}
                alt=""
                width={320}
                height={180}
                loading="lazy"
                decoding="async"
                className="aspect-video w-28 shrink-0 rounded-lg bg-surface-2 object-cover ring-1 ring-black/5 sm:w-36"
              />
              <span className="min-w-0">
                <span className="eyebrow block">{v.category}</span>
                <span className="mt-0.5 line-clamp-2 text-sm font-semibold text-ink group-hover:text-maroon">
                  {v.title}
                </span>
                <span className="mt-1 block text-xs text-ink-3">
                  {[formatDate(v.publishedAt), v.channel !== DEFAULT_CHANNEL && v.channel]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

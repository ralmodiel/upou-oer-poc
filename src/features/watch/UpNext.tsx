import { Link } from 'react-router'
import SectionHeading from '../../components/ui/SectionHeading'
import { DEFAULT_CHANNEL } from '../../data/expand'
import { formatDate } from '../../lib/format'
import type { UpNextItem } from './recommendations'
import './watch.css'

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * Compact list of recommended videos; each row is one link, so it is keyboard operable as is
 * (the shell's focus ring applies, and the thumbnail takes a gold frame). The reason sits above
 * the title in sentence case and may take two lines; without one the collection eyebrow stands in.
 */
export default function UpNext({ items }: { items: readonly UpNextItem[] }) {
  if (!items.length) return null
  return (
    <section>
      <SectionHeading title="Up next" id="up-next-heading" />
      <ol
        aria-labelledby="up-next-heading"
        className="mt-3 divide-y divide-line border-y border-line"
      >
        {items.map(({ video: v, reason }) => (
          <li key={v.id}>
            <Link
              to={`/watch/${v.id}`}
              className="watch-next group -mx-2 flex gap-3 rounded-card px-2 py-3 transition-colors hover:bg-surface-2"
            >
              <img
                src={v.thumbnail}
                alt=""
                width={320}
                height={180}
                loading="lazy"
                decoding="async"
                className="aspect-video w-28 shrink-0 self-start rounded-lg bg-surface-2 object-cover ring-1 ring-black/5 sm:w-36"
              />
              <span className="min-w-0 self-center">
                {reason ? (
                  <span className="line-clamp-2 text-xs/snug font-medium text-forest">
                    {sentence(reason)}
                  </span>
                ) : (
                  <span className="eyebrow block truncate">{v.category}</span>
                )}
                <span className="mt-1 line-clamp-2 text-sm/snug font-semibold text-ink group-hover:text-maroon">
                  {v.title}
                </span>
                <span className="mt-1 block truncate text-xs text-ink-3">
                  {[
                    formatDate(v.publishedAt),
                    reason && v.category,
                    v.channel !== DEFAULT_CHANNEL && v.channel,
                  ]
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

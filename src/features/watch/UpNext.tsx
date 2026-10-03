import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import SectionHeading from '../../components/ui/SectionHeading'
import { DEFAULT_CHANNEL } from '../../data/expand'
import { formatDate } from '../../lib/format'
import type { Profile } from '../../lib/history'
import { isRecommenderReady, warmRecommenderAsync } from '../../lib/recommend'
import type { Video } from '../../types'
import { upNextFor, upNextPlaceholder, type UpNextItem } from './recommendations'
import './watch.css'

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

interface Rows {
  items: UpNextItem[]
  /** The recommender's picks (else the stand-ins shown while its index builds). */
  final: boolean
}

/**
 * Compact list of recommended videos; each row is one link, so it is keyboard operable as is
 * (the shell's focus ring applies, and the thumbnail takes a gold frame). The reason sits above
 * the title in sentence case; without one the collection eyebrow stands in.
 *
 * Picked once per video (the watch page keys this by video) with the profile of that moment, so
 * the list is not re-ranked while watching. On a cold visit the recommender's index is not built
 * yet, and building it at once would block the first paint: the collection's newest stand in and
 * the picks replace them, row for row in rows of one fixed height, once the index has been built
 * in short slices. A pointer or focus on the list holds the swap until it leaves.
 */
export default function UpNext({ video, profile }: { video: Video; profile: Profile }) {
  const listRef = useRef<HTMLOListElement>(null)
  const [picked] = useState(profile)
  const [rows, setRows] = useState<Rows>(() =>
    isRecommenderReady()
      ? { items: upNextFor(video, picked), final: true }
      : { items: upNextPlaceholder(video), final: false },
  )

  useEffect(() => {
    if (rows.final) return
    let live = true
    let detach = () => {}
    void warmRecommenderAsync().then(() => {
      if (!live) return
      const items = upNextFor(video, picked)
      const list = listRef.current
      const busy = () => !!list && (list.contains(document.activeElement) || list.matches(':hover'))
      const swap = () => {
        if (!live || busy()) return
        detach()
        setRows({ items, final: true })
      }
      if (!list || !busy()) return swap()
      const later = () => setTimeout(swap)
      list.addEventListener('focusout', later)
      list.addEventListener('pointerleave', later)
      detach = () => {
        list.removeEventListener('focusout', later)
        list.removeEventListener('pointerleave', later)
      }
    })
    return () => {
      live = false
      detach()
    }
  }, [rows.final, video, picked])

  if (!rows.items.length) return null
  return (
    <section>
      <SectionHeading title="Up next" id="up-next-heading" />
      <ol
        ref={listRef}
        aria-labelledby="up-next-heading"
        className="mt-3 divide-y divide-line border-y border-line"
      >
        {/* Rows are keyed by position, so the picks take over the stand-ins' rows and thumbnails;
            their text is new (keyed by video), so a different line count moves no old text. */}
        {rows.items.map(({ video: v, reason }, i) => (
          <li key={i}>
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
              <span key={v.id} className="watch-next-text min-w-0 self-center">
                {reason ? (
                  <span className="block truncate text-xs/snug font-medium text-forest">
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

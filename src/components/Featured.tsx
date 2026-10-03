import { memo, useId, useState } from 'react'
import { Link } from 'react-router'
import { summaryOf } from '../data/catalog'
import { formatDate } from '../lib/format'
import type { Video } from '../types'
import DetailsLink from './DetailsLink'
import MyListButton from './MyListButton'
import PlayLink from './PlayLink'
import Thumbnail from './Thumbnail'
import { ChevronLeftIcon, ChevronRightIcon, InfoIcon, PlayIcon } from './icons'
import { slugOfCategory } from './media'
import IconButton from './ui/IconButton'
import { buttonClass } from './ui/button-styles'

interface Props {
  videos: readonly Video[]
  /** Newest titles shown beside the featured one. */
  alsoNew: readonly Video[]
}

/** Editorial opener: one featured video with its text, manual prev/next, and an "Also new" list. */
function Featured({ videos, alsoNew }: Props) {
  const headingId = useId()
  const [index, setIndex] = useState(0)
  const count = videos.length
  const video = videos[Math.min(index, count - 1)]
  if (!video) return null
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count)

  return (
    <section aria-labelledby={headingId} className="px-(--gutter) pt-6 sm:pt-8 lg:pt-10">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="min-w-0 lg:col-span-7">
          <div className="flex items-center justify-between gap-4">
            <h2 id={headingId} className="eyebrow">
              Featured
            </h2>
            {count > 1 && (
              <div className="flex items-center gap-2">
                <span aria-live="polite" className="text-sm text-ink-3 tabular-nums">
                  {index + 1} of {count}
                </span>
                <IconButton
                  label="Previous featured video"
                  icon={<ChevronLeftIcon />}
                  variant="secondary"
                  onClick={() => go(-1)}
                />
                <IconButton
                  label="Next featured video"
                  icon={<ChevronRightIcon />}
                  variant="secondary"
                  onClick={() => go(1)}
                />
              </div>
            )}
          </div>

          <div role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${count}`}>
            {/* Decorative duplicate of the Play button: the image is clickable but not a Tab stop. */}
            <PlayLink video={video} tabIndex={-1} aria-hidden="true" className="mt-3 block">
              <Thumbnail
                video={video}
                sizes="(min-width: 64rem) 55vw, 100vw"
                large
                loading="eager"
                fetchPriority={index === 0 ? 'high' : undefined}
                className="rounded-card ring-1 ring-black/5"
              />
            </PlayLink>
            <div className="mt-5">
              <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-3">
                <Link
                  to={`/collections/${slugOfCategory(video.category)}`}
                  className="eyebrow -my-3 py-3 hover:underline"
                >
                  {video.category}
                </Link>
                <span aria-hidden="true">·</span>
                <time dateTime={video.publishedAt}>{formatDate(video.publishedAt)}</time>
              </p>
              <h3 className="mt-2 line-clamp-3 font-display text-title text-balance text-ink">
                {video.title}
              </h3>
              <p className="mt-3 line-clamp-3 max-w-2xl text-base text-ink-2">{summaryOf(video)}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <PlayLink video={video} className={buttonClass('primary')}>
                  <PlayIcon />
                  Play
                </PlayLink>
                <DetailsLink id={video.id} className={buttonClass('secondary')}>
                  <InfoIcon />
                  Details
                </DetailsLink>
                <MyListButton
                  id={video.id}
                  title={video.title}
                  className={buttonClass(
                    'secondary',
                    'md',
                    'aria-pressed:border-maroon aria-pressed:text-maroon',
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        {alsoNew.length > 0 && (
          <aside className="min-w-0 lg:col-span-5" aria-labelledby={`${headingId}-new`}>
            <h3 id={`${headingId}-new`} className="eyebrow">
              Also new
            </h3>
            <ol className="mt-3 divide-y divide-line border-y border-line">
              {alsoNew.map((v) => (
                <li key={v.id}>
                  <article className="group/item relative flex gap-4 py-3">
                    <Thumbnail
                      video={v}
                      sizes="128px"
                      className="w-32 shrink-0 rounded-lg ring-1 ring-black/5"
                    />
                    <div className="min-w-0">
                      <p className="eyebrow truncate">{v.category}</p>
                      <h4 className="mt-1 line-clamp-2 text-base/snug font-semibold text-ink transition-colors group-hover/item:text-maroon">
                        <PlayLink
                          video={v}
                          aria-label={`Play ${v.title}`}
                          className="after:absolute after:inset-0"
                        >
                          {v.title}
                        </PlayLink>
                      </h4>
                      <p className="mt-1 text-sm text-ink-3">
                        <time dateTime={v.publishedAt}>{formatDate(v.publishedAt)}</time>
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>
    </section>
  )
}

export default memo(Featured)

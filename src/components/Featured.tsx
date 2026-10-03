import { memo, useId, useState } from 'react'
import { formatDate } from '../lib/format'
import type { Video } from '../types'
import Backdrop from './Backdrop'
import DetailsLink from './DetailsLink'
import MyListButton from './MyListButton'
import PlayLink from './PlayLink'
import Thumbnail from './Thumbnail'
import { FactsLine, LONG_TITLE } from './browse-ui'
import { ChevronLeftIcon, ChevronRightIcon, InfoIcon, PlayIcon } from './icons'
import { imagesOf } from './media'
import { useCardPreview } from './preview'
import IconButton from './ui/IconButton'
import { PRESSED, buttonClass } from './ui/button-styles'

interface Props {
  videos: readonly Video[]
  /** Newest titles shown beside the featured one. */
  alsoNew: readonly Video[]
  /** First slide; by default a random one per page load. */
  start?: number
}

// Drawn once per page load, so a refresh opens on another slide (and backdrop) too.
const LOAD_PICK = Math.random()

// Fades the blurred still into the page, fully by the bottom edge where the text sits.
const SCRIM = 'bg-linear-to-b from-paper/70 via-paper/85 via-55% to-paper'

// A round icon button below 640px.
const ICON_ON_PHONE = 'max-sm:w-11 max-sm:px-0'

/**
 * Editorial opener on a full-bleed backdrop of the featured video: the video with its text,
 * manual prev/next, and an "Also new" list.
 */
function Featured({ videos, alsoNew, start }: Props) {
  const headingId = useId()
  const count = videos.length
  // A random slide per load among those with an image: a title tile opens the page only when no
  // featured video has one (the others stay one press away).
  const pool = videos.flatMap((v, i) => (imagesOf(v, true) ? [i] : []))
  const first = start ?? (pool.length ? pool[Math.floor(LOAD_PICK * pool.length)] : 0)
  const [index, setIndex] = useState(first)
  const video = videos[Math.min(index, count - 1)]
  if (!video) return null
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count)
  const long = video.title.length > LONG_TITLE

  return (
    <div className="relative isolate overflow-hidden">
      <Backdrop video={video} scrim={SCRIM} />
      <section
        aria-labelledby={headingId}
        className="px-(--gutter) pt-6 pb-8 sm:pt-8 lg:pt-10 lg:pb-10"
      >
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
              <Hero video={video} priority={index === first} />
              <div className="mt-5">
                <h3
                  title={video.title}
                  className={`font-display text-balance text-ink ${
                    long ? 'line-clamp-4 text-2xl sm:text-3xl' : 'line-clamp-3 text-title'
                  }`}
                >
                  {video.title}
                </h3>
                <FactsLine video={video} className="mt-3" passOver />
                {video.description && (
                  <p className="mt-3 line-clamp-3 max-w-2xl text-base text-ink-2">
                    {video.description}
                  </p>
                )}
                {/* One row at every width (Details and Save as icons on phones): ↓ from Play leaves
                    the hero instead of stopping on a wrapped Save. */}
                <div className="mt-5 flex items-center gap-3">
                  <PlayLink video={video} data-spatial="entry" className={buttonClass('primary')}>
                    <PlayIcon />
                    Play
                  </PlayLink>
                  <DetailsLink
                    id={video.id}
                    className={buttonClass('secondary', 'md', ICON_ON_PHONE)}
                  >
                    <InfoIcon />
                    <span className="max-sm:sr-only">Details</span>
                  </DetailsLink>
                  <MyListButton
                    id={video.id}
                    title={video.title}
                    className={buttonClass('secondary', 'md', `${ICON_ON_PHONE} ${PRESSED}`)}
                    labelClassName="max-sm:sr-only"
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
              {/* One stop for ↑ / ↓ (entered at its first title); ← / → walk the titles. */}
              <ol data-spatial="group" className="mt-3 divide-y divide-line border-y border-line">
                {alsoNew.map((v) => (
                  <li key={v.id}>
                    <AlsoNewItem video={v} />
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </div>
      </section>
    </div>
  )
}

/** The featured image: clickable (plays) but not a Tab stop; previews on hover like a card. */
function Hero({ video, priority }: { video: Video; priority: boolean }) {
  const { hostProps, overlay } = useCardPreview(video)
  return (
    <div {...hostProps} className="mt-3">
      {/* Decorative duplicate of the Play button. */}
      <PlayLink video={video} tabIndex={-1} aria-hidden="true" className="block">
        <Thumbnail
          video={video}
          sizes="(min-width: 64rem) 55vw, 100vw"
          large
          canonical
          loading="eager"
          fetchPriority={priority ? 'high' : undefined}
          className="rounded-card shadow-lift ring-1 ring-black/10"
        >
          {overlay}
        </Thumbnail>
      </PlayLink>
    </div>
  )
}

function AlsoNewItem({ video }: { video: Video }) {
  const { hostProps, overlay } = useCardPreview(video)
  return (
    <article {...hostProps} className="group/item relative flex gap-4 py-3">
      {/* Original stills: in a short list one black or flash frame would stand out. */}
      <Thumbnail
        video={video}
        sizes="(min-width: 40rem) 160px, 128px"
        canonical
        className="w-32 shrink-0 rounded-lg ring-1 ring-black/5 sm:w-40"
      >
        {overlay}
      </Thumbnail>
      <div className="min-w-0">
        <p className="eyebrow truncate">{video.category}</p>
        <h4
          title={video.title}
          className="mt-1 line-clamp-2 text-base/snug font-semibold text-ink transition-colors group-hover/item:text-maroon"
        >
          <PlayLink
            video={video}
            aria-label={`Play ${video.title}`}
            data-card-link=""
            className="after:absolute after:inset-0"
          >
            {video.title}
          </PlayLink>
        </h4>
        <p className="mt-1 text-sm text-ink-3">
          <time dateTime={video.publishedAt}>{formatDate(video.publishedAt)}</time>
        </p>
      </div>
    </article>
  )
}

export default memo(Featured)

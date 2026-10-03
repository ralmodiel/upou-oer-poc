import { memo, useId } from 'react'
import type { Video } from '../types'
import PlayLink from './PlayLink'
import { srcSetOf } from './media'
import SectionHeading from './ui/SectionHeading'

/** Compact, snap-scrolling strip of recently watched videos; hidden until there is history. */
function ContinueWatching({ videos }: { videos: readonly Video[] }) {
  const headingId = useId()
  if (!videos.length) return null
  return (
    <section aria-labelledby={headingId} className="border-t border-line pt-6 pb-4">
      <div className="px-(--gutter)">
        <SectionHeading
          id={headingId}
          title="Continue watching"
          description="Pick up where you left off."
        />
      </div>
      <ul
        role="list"
        className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-(--gutter) px-(--gutter) pb-2 scrollbar-none"
      >
        {videos.map((video) => (
          <li key={video.id} className="w-48 flex-none snap-start sm:w-56">
            <article className="group/item relative">
              <img
                src={video.thumbnail}
                srcSet={srcSetOf(video)}
                sizes="224px"
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-video w-full rounded-lg bg-surface-2 object-cover ring-1 ring-black/5"
              />
              <p className="eyebrow mt-2 truncate">{video.category}</p>
              <h3 className="mt-0.5 line-clamp-2 text-sm/snug font-semibold text-ink transition-colors group-hover/item:text-maroon">
                <PlayLink
                  video={video}
                  aria-label={`Play ${video.title}`}
                  className="after:absolute after:inset-0"
                >
                  {video.title}
                </PlayLink>
              </h3>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default memo(ContinueWatching)

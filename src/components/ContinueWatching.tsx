import { memo, useId } from 'react'
import type { Video } from '../types'
import PlayLink from './PlayLink'
import Thumbnail from './Thumbnail'
import { useCardPreview } from './preview'
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
            <Item video={video} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function Item({ video }: { video: Video }) {
  const { hostProps, overlay } = useCardPreview(video)
  return (
    <article {...hostProps} className="group/item relative">
      <Thumbnail video={video} sizes="224px" className="rounded-lg ring-1 ring-black/5">
        {overlay}
      </Thumbnail>
      <p className="eyebrow mt-2 truncate">{video.category}</p>
      <h3 className="mt-0.5 line-clamp-2 text-sm/snug font-semibold text-ink transition-colors group-hover/item:text-maroon">
        <PlayLink
          video={video}
          aria-label={`Play ${video.title}`}
          data-card-link=""
          className="after:absolute after:inset-0"
        >
          {video.title}
        </PlayLink>
      </h3>
    </article>
  )
}

export default memo(ContinueWatching)

import { ExternalLinkIcon } from '../../components/icons'
import { watchUrl } from '../../lib/youtube'
import type { Video } from '../../types'

const LINK =
  'group inline-flex h-10 items-center gap-1.5 text-sm font-semibold text-maroon underline-offset-4 hover:text-maroon-2 hover:underline'

/** Where the video comes from, beside a label like the topics': YouTube and the source page. */
export default function WatchSource({ video }: { video: Video }) {
  const links = [
    { href: watchUrl(video.youtubeId), label: 'Watch on YouTube' },
    { href: video.sourceUrl, label: 'View on oer.upou.edu.ph' },
  ]
  return (
    <section aria-labelledby="source-heading" className="watch-row">
      <h2 id="source-heading" className="eyebrow">
        Source
      </h2>
      <ul className="flex flex-wrap gap-x-6">
        {links.map(({ href, label }) => (
          <li key={label}>
            <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
              {label}
              <ExternalLinkIcon className="size-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

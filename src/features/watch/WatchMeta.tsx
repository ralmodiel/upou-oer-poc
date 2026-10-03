import { Link } from 'react-router'
import LinkButton from '../../components/ui/LinkButton'
import type { Category } from '../../data/catalog'
import { formatDate } from '../../lib/format'
import { watchUrl } from '../../lib/youtube'
import type { Video } from '../../types'
import { ExternalIcon, PlayIcon } from './icons'
import SaveButton from './SaveButton'
import ShareButton from './ShareButton'

const Dot = () => (
  <span aria-hidden="true" className="text-ink-3">
    ·
  </span>
)

const NewTab = () => <span className="sr-only"> (opens in a new tab)</span>

/** Category · date · channel, then the action row. */
export default function WatchMeta({ video, category }: { video: Video; category?: Category }) {
  const date = formatDate(video.publishedAt)
  return (
    <>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
        {category && (
          <>
            <Link to={`/collections/${category.slug}`} className="eyebrow hover:underline">
              {category.name}
            </Link>
            <Dot />
          </>
        )}
        {date && (
          <>
            <time dateTime={video.publishedAt}>{date}</time>
            <Dot />
          </>
        )}
        <span>{video.channel}</span>
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <LinkButton
          variant="secondary"
          size="sm"
          href={watchUrl(video.youtubeId)}
          external
          icon={<PlayIcon />}
          iconEnd={<ExternalIcon className="text-ink-3" />}
        >
          Watch on YouTube
          <NewTab />
        </LinkButton>
        <LinkButton
          variant="secondary"
          size="sm"
          href={video.sourceUrl}
          external
          iconEnd={<ExternalIcon className="text-ink-3" />}
        >
          View on oer.upou.edu.ph
          <NewTab />
        </LinkButton>
        <ShareButton title={video.title} />
        <SaveButton video={video} />
      </div>
    </>
  )
}

import { ExternalLinkIcon, PlayIcon } from '../../components/icons'
import LinkButton from '../../components/ui/LinkButton'
import { formatDate } from '../../lib/format'
import { watchUrl } from '../../lib/youtube'
import type { Video } from '../../types'
import SaveButton from './SaveButton'
import ShareButton from './ShareButton'
import './watch.css'

const NewTab = () => <span className="sr-only"> (opens in a new tab)</span>

/** Date · channel (the breadcrumb already names the collection), then the action row. */
export default function WatchMeta({ video }: { video: Video }) {
  const date = formatDate(video.publishedAt)
  return (
    <>
      <ul className="watch-meta mt-3 flex flex-wrap items-center text-sm text-ink-2">
        {date && (
          <li>
            <time dateTime={video.publishedAt}>{date}</time>
          </li>
        )}
        <li>{video.channel}</li>
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <LinkButton
          variant="secondary"
          size="sm"
          href={watchUrl(video.youtubeId)}
          external
          icon={<PlayIcon />}
          iconEnd={<ExternalLinkIcon className="text-ink-3" />}
        >
          Watch on YouTube
          <NewTab />
        </LinkButton>
        <LinkButton
          variant="secondary"
          size="sm"
          href={video.sourceUrl}
          external
          iconEnd={<ExternalLinkIcon className="text-ink-3" />}
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

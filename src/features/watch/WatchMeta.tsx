import { Link } from 'react-router'
import { ExternalLinkIcon, PlayIcon } from '../../components/icons'
import LinkButton from '../../components/ui/LinkButton'
import type { Category } from '../../data/catalog'
import { formatDate } from '../../lib/format'
import { watchUrl } from '../../lib/youtube'
import type { Video } from '../../types'
import SaveButton from './SaveButton'
import ShareButton from './ShareButton'
import './watch.css'

const NewTab = () => <span className="sr-only"> (opens in a new tab)</span>

/**
 * The collection as a tab in its brand colour, date · channel · licence, then the action row.
 */
export default function WatchMeta({ video, category }: { video: Video; category?: Category }) {
  const date = formatDate(video.publishedAt)
  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-2">
        {category && (
          <Link to={`/collections/${category.slug}`} className="watch-tab">
            <span>{category.name}</span>
          </Link>
        )}
        <div className="watch-meta">
          <ul className="flex flex-wrap items-center">
            {date && (
              <li>
                <time dateTime={video.publishedAt}>{date}</time>
              </li>
            )}
            <li>{video.channel}</li>
            <li className="font-medium text-forest">Free · CC BY 4.0</li>
          </ul>
        </div>
      </div>
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

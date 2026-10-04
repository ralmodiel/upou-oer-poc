import { Link } from 'react-router'
import type { Category } from '../../data/catalog'
import { formatDate } from '../../lib/format'
import type { Video } from '../../types'
import SaveButton from './SaveButton'
import ShareButton from './ShareButton'
import './watch.css'

/**
 * One line of facts that wraps item by item: the collection as a tab in its brand colour, then
 * date · channel · licence. Under it the page's own actions, Save and Share (the source links sit
 * with the topics, in WatchSource).
 */
export default function WatchMeta({ video, category }: { video: Video; category?: Category }) {
  const date = formatDate(video.publishedAt)
  return (
    <>
      <div className="watch-meta text-sm text-ink-2">
        <ul className="flex flex-wrap items-center gap-y-2">
          {category && (
            <li className="watch-meta-tab">
              <Link to={`/collections/${category.slug}`} className="watch-tab">
                <span>{category.name}</span>
              </Link>
            </li>
          )}
          {date && (
            <li>
              <time dateTime={video.publishedAt}>{date}</time>
            </li>
          )}
          <li>{video.channel}</li>
          <li className="font-medium text-forest">Free · CC BY 4.0</li>
        </ul>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SaveButton video={video} />
        <ShareButton title={video.title} />
      </div>
    </>
  )
}

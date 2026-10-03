import { useInMyList } from '../lib/storage'
import { BookmarkFilledIcon, BookmarkIcon } from './icons-browse'

interface Props {
  id: string
  title: string
  className: string
  iconClassName?: string
  tabIndex?: number
}

/** Labelled Save toggle for My List; subscribes to this one video only. */
export default function MyListButton({
  id,
  title,
  className,
  iconClassName = 'size-4',
  tabIndex,
}: Props) {
  const [saved, toggle] = useInMyList(id)
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={`Save ${title}`}
      onClick={toggle}
      tabIndex={tabIndex}
      className={className}
    >
      {saved ? (
        <BookmarkFilledIcon className={iconClassName} />
      ) : (
        <BookmarkIcon className={iconClassName} />
      )}
      {saved ? 'Saved' : 'Save'}
    </button>
  )
}

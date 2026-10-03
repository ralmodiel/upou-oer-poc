import { useInMyList } from '../lib/storage'
import { BookmarkFilledIcon, BookmarkIcon } from './icons'

interface Props {
  id: string
  title: string
  className: string
  iconClassName?: string
  /** Classes for the visible Save / Saved text (e.g. visually hidden on phones). */
  labelClassName?: string
  tabIndex?: number
}

/** Labelled Save toggle for My List; subscribes to this one video only. */
export default function MyListButton({
  id,
  title,
  className,
  iconClassName = 'size-4',
  labelClassName,
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
      {labelClassName ? (
        <span className={labelClassName}>{saved ? 'Saved' : 'Save'}</span>
      ) : saved ? (
        'Saved'
      ) : (
        'Save'
      )}
    </button>
  )
}

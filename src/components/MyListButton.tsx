import { useMyList } from '../lib/storage'
import { CheckIcon, PlusIcon } from './icons'

interface Props {
  id: string
  title: string
  className?: string
  iconClassName?: string
}

/** Kept separate so a list change re-renders only these buttons, not whole cards. */
export default function MyListButton({
  id,
  title,
  className = '',
  iconClassName = 'size-4',
}: Props) {
  const { has, toggle } = useMyList()
  const saved = has(id)
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={`My List: ${title}`}
      onClick={() => toggle(id)}
      className={`grid place-items-center rounded-full bg-ink-950/60 text-white ring-2 ring-white/50 backdrop-blur-sm transition duration-200 ease-cinematic hover:bg-ink-950/80 hover:ring-white aria-pressed:bg-brand-600/30 aria-pressed:ring-brand-400 ${className}`}
    >
      {saved ? <CheckIcon className={iconClassName} /> : <PlusIcon className={iconClassName} />}
    </button>
  )
}

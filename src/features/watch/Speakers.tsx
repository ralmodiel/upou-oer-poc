import { getVideo } from '../../data/catalog'
import { speakersOf } from '../../data/speakers'

const LIST = new Intl.ListFormat('en', { type: 'conjunction' })

/**
 * Who speaks, on its own line under a video's title (never part of it): a small "Speaker" label,
 * then the names as the source writes them. Nothing when the source names no one. `id` is the
 * video's id (its slug); speakers.json is keyed by its YouTube id.
 */
export default function Speakers({ id, className = '' }: { id: string; className?: string }) {
  const names = speakersOf(getVideo(id)?.youtubeId ?? '')
  if (!names.length) return null
  return (
    <p className={`flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-ink ${className}`}>
      <span className="eyebrow">{names.length > 1 ? 'Speakers' : 'Speaker'}</span>
      <span className="font-medium text-pretty">{LIST.format(names)}</span>
    </p>
  )
}

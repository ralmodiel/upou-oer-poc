import Button from '../../components/ui/Button'
import { useMyList } from '../../lib/storage'
import type { Video } from '../../types'
import { CheckIcon, PlusIcon } from './icons'

/** My List toggle with a visible label. */
export default function SaveButton({ video }: { video: Video }) {
  const { has, toggle } = useMyList()
  const saved = has(video.id)
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-pressed={saved}
      aria-label={saved ? 'Saved to My List' : 'Save to My List'}
      onClick={() => toggle(video.id)}
      icon={saved ? <CheckIcon /> : <PlusIcon />}
      className="aria-pressed:border-maroon aria-pressed:bg-maroon-soft aria-pressed:text-maroon"
    >
      {saved ? 'Saved' : 'Save'}
    </Button>
  )
}

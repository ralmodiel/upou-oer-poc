import { useEffect, useState } from 'react'
import { ThumbUpIcon } from '../../components/icons'
import Button from '../../components/ui/Button'
import { getRating, hasYtToken, rate, ytLikeEnabled, type Rating } from '../../lib/ytLike'
import type { Video } from '../../types'
import './watch.css'

/**
 * Like on YouTube, opt-in (see lib/ytLike.ts). Not signed in, the press signs in first and then
 * likes (a video already liked is shown liked, never unliked by the sign-in press). Once a token is
 * held, the current rating is read on arrival. Renders nothing when the feature is off.
 */
export default function LikeButton({ video }: { video: Video }) {
  const id = video.youtubeId
  // Keyed by video, so a new video starts blank without resetting state in an effect.
  const [seen, setSeen] = useState<{ id: string; rating: Rating | null; failed: boolean }>()
  const rating = seen?.id === id ? seen.rating : null
  const failed = seen?.id === id && seen.failed
  const setRating = (r: Rating) => setSeen({ id, rating: r, failed: false })
  const setFailed = (f: boolean) => setSeen({ id, rating, failed: f })
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!ytLikeEnabled || !hasYtToken()) return
    let live = true
    getRating(id).then(
      (r) => live && setSeen({ id, rating: r, failed: false }),
      () => undefined, // the button still works; a press reports any failure
    )
    return () => {
      live = false
    }
  }, [id])

  if (!ytLikeEnabled) return null

  const press = async () => {
    setPending(true)
    setFailed(false)
    try {
      if (rating === 'like') {
        await rate(id, 'none')
        setRating('none')
      } else {
        const signedIn = hasYtToken()
        const current = signedIn ? 'none' : await getRating(id)
        if (current !== 'like') await rate(id, 'like')
        setRating('like')
      }
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  const liked = rating === 'like'
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        aria-pressed={liked}
        aria-busy={pending || undefined}
        aria-label={liked ? 'Liked on YouTube (press to remove)' : 'Like on YouTube'}
        aria-disabled={pending || undefined}
        onClick={() => {
          if (!pending) void press()
        }}
        icon={<ThumbUpIcon />}
        className="watch-save"
      >
        {liked ? 'Liked' : 'Like'}
      </Button>
      <span role="status" className="text-sm font-medium text-ink-2">
        {failed && 'Couldn’t reach YouTube'}
      </span>
    </span>
  )
}

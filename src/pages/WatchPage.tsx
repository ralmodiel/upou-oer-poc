import { useEffect, useEffectEvent, useState } from 'react'
import { preconnect } from 'react-dom'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useDocumentTitle } from '../components/hooks'
import { ExternalLinkIcon } from '../components/icons'
import { getVideo } from '../data/catalog'
import { BackIcon } from '../features/player/icons'
import { useIdle } from '../features/player/useIdle'
import YouTubePlayer from '../features/player/YouTubePlayer'
import PromoReel from '../features/reel/PromoReel'
import { useWatchHistory } from '../lib/storage'
import { watchUrl } from '../lib/youtube'
import type { Video } from '../types'

const ORIGINS = [
  'https://www.youtube-nocookie.com',
  'https://www.youtube.com',
  'https://i.ytimg.com',
]

export default function WatchPage() {
  const { id } = useParams()
  const video = getVideo(id)
  return video ? <Watch key={video.id} video={video} /> : <NotFound />
}

function Watch({ video }: { video: Video }) {
  const [phase, setPhase] = useState<'reel' | 'player'>('reel')
  const navigate = useNavigate()
  const { key } = useLocation()
  const { record } = useWatchHistory()
  const idle = useIdle(3000)
  for (const origin of ORIGINS) preconnect(origin)

  const goBack = () => {
    if (key !== 'default') void navigate(-1)
    // Opened directly: replace the entry so the browser's Back doesn't return to the reel.
    else void navigate('/', { replace: true })
  }
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !e.defaultPrevented) goBack()
  })

  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyDown(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  useDocumentTitle(`${video.title} · UPOU Networks`)

  const startPlayer = () => {
    setPhase('player')
    record(video.id)
  }

  return (
    <div
      className={`fixed inset-0 overflow-hidden bg-black text-white ${idle && phase === 'reel' ? 'cursor-none' : ''}`}
    >
      {phase === 'reel' ? (
        <PromoReel video={video} onComplete={startPlayer} />
      ) : (
        <YouTubePlayer video={video} />
      )}
      <header
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 bg-linear-to-b from-black/80 via-black/35 to-transparent pb-10 transition-opacity duration-300 hover:opacity-100 focus-within:opacity-100 ${idle ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="pointer-events-auto flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-4 sm:px-6">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="grid size-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/15"
          >
            <BackIcon className="size-6" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-lg">
            {video.title}
          </h1>
          <a
            href={watchUrl(video.youtubeId)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open on YouTube"
            className="flex shrink-0 items-center gap-2 rounded-full border border-white/30 px-3 py-2 text-sm font-medium transition-colors hover:border-white hover:bg-white/10"
          >
            <span className="hidden sm:inline">Open on YouTube</span>
            <ExternalLinkIcon className="size-4" />
          </a>
        </div>
      </header>
    </div>
  )
}

function NotFound() {
  useDocumentTitle('Video not found · UPOU Networks')
  return (
    <main className="fixed inset-0 grid place-items-center bg-ink-950 px-6 text-center text-white">
      <div className="max-w-md">
        <p className="text-sm font-semibold tracking-[0.3em] text-brand-400 uppercase">
          UPOU Networks
        </p>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Video not found</h1>
        <p className="mt-3 text-neutral-400">
          This video may have moved or is no longer available.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-md bg-brand-600 px-5 py-3 font-semibold transition-colors hover:bg-brand-500"
        >
          Back to Home
        </Link>
      </div>
    </main>
  )
}

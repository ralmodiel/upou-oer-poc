import { useEffect, useRef, useState } from 'react'
import { preconnect } from 'react-dom'
import { Link, useParams } from 'react-router'
import Breadcrumbs, { type Crumb } from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import NotFound from '../components/ui/NotFound'
import { getCategoryByName, getVideo } from '../data/catalog'
import YouTubePlayer from '../features/player/YouTubePlayer'
import PromoReel from '../features/reel/PromoReel'
import EscHint from '../features/watch/EscHint'
import { BackIcon } from '../features/watch/icons'
import UpNext from '../features/watch/UpNext'
import { upNextFor } from '../features/watch/recommendations'
import WatchBackdrop from '../features/watch/WatchBackdrop'
import WatchMeta from '../features/watch/WatchMeta'
import WatchTags from '../features/watch/WatchTags'
import '../features/watch/watch.css'
import { useProfile } from '../lib/history'
import { pageTitle, useSeo, videoSeo } from '../lib/seo'
import { useGoBack } from '../lib/shortcuts'
import { useWatchHistory } from '../lib/storage'
import type { Video } from '../types'

const ORIGINS = [
  'https://www.youtube-nocookie.com',
  'https://www.youtube.com',
  'https://i.ytimg.com',
]
const LONG_TITLE = 120

export default function WatchPage() {
  const { id } = useParams()
  const video = getVideo(id)
  return video ? <Watch key={video.id} video={video} /> : <WatchNotFound />
}

function Watch({ video }: { video: Video }) {
  const [phase, setPhase] = useState<'reel' | 'player'>('reel')
  const goBack = useGoBack()
  const { record } = useWatchHistory()
  const stageRef = useRef<HTMLDivElement>(null)
  const profile = useProfile()
  // Picked once per video (this component is keyed by id) with the profile at that moment, so
  // the list is not re-ranked while watching. Rendered with the page: a later arrival would
  // shift the footer on short pages.
  const [upNext] = useState(() => upNextFor(video, profile))
  const category = getCategoryByName(video.category)
  useSeo(videoSeo(video, category))
  for (const origin of ORIGINS) preconnect(origin)

  // Focus the stage (never the YouTube iframe) when the reel starts and again when the player
  // appears, so the app shell's Esc = Back handler keeps receiving key events.
  useEffect(() => {
    stageRef.current?.focus({ preventScroll: true })
  }, [phase])

  // Chrome treats focus moved by script as :focus-visible until the first pointer event, which
  // would ring the stage for the whole reel on load; show the ring only once a key has been used.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const keyed = () => stage.toggleAttribute('data-kbd', true)
    const pointed = () => stage.toggleAttribute('data-kbd', false)
    window.addEventListener('keydown', keyed, true)
    window.addEventListener('pointerdown', pointed, true)
    return () => {
      window.removeEventListener('keydown', keyed, true)
      window.removeEventListener('pointerdown', pointed, true)
    }
  }, [])

  const startPlayer = () => {
    setPhase('player')
    record(video.id)
  }

  // Once the user clicks into the video, the iframe swallows key events; take focus back as
  // soon as the pointer leaves the stage so Esc works again.
  const reclaimFocus = () => {
    const stage = stageRef.current
    const active = document.activeElement
    if (stage && active instanceof HTMLIFrameElement && stage.contains(active)) {
      stage.focus({ preventScroll: true })
    }
  }

  // Most source pages have no description; say so instead of padding with metadata.
  const about =
    video.description ||
    `No description was published for this video. It is part of ${video.channel}'s ${video.category} collection.`
  const crumbs: Crumb[] = [{ label: 'Browse', to: '/' }]
  if (category) crumbs.push({ label: category.name, to: `/collections/${category.slug}` })
  crumbs.push({ label: video.title })

  return (
    <div className="watch-page pb-16">
      <WatchBackdrop video={video} />
      <div className="mx-auto w-full max-w-[1600px] px-(--gutter)">
        <div className="lg:grid lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-8">
            <div className="flex min-h-14 items-center justify-between gap-3 py-2">
              <Button variant="secondary" size="sm" icon={<BackIcon />} onClick={goBack}>
                Back
              </Button>
              <EscHint />
            </div>

            <div
              ref={stageRef}
              tabIndex={-1}
              role="region"
              aria-label={phase === 'reel' ? 'Preview' : 'Video player'}
              onPointerLeave={reclaimFocus}
              className="watch-stage relative aspect-video overflow-hidden bg-surface shadow-lift outline-none ring-1 ring-black/5 data-kbd:focus-visible:ring-2 data-kbd:focus-visible:ring-maroon md:rounded-card"
            >
              {phase === 'reel' ? (
                <PromoReel video={video} onComplete={startPlayer} />
              ) : (
                <YouTubePlayer video={video} />
              )}
            </div>

            <article className="pt-5">
              <Breadcrumbs items={crumbs} className="watch-crumbs" />
              <h1
                className="watch-title mt-3 font-display text-title text-balance text-ink"
                data-long={video.title.length > LONG_TITLE || undefined}
              >
                {video.title}
              </h1>
              <WatchMeta video={video} />
              <p className="mt-5 max-w-prose text-base leading-relaxed whitespace-pre-line text-ink-2">
                {about}
              </p>
              <WatchTags tags={video.tags} />
            </article>
          </div>

          <aside className="pt-10 lg:col-span-4 lg:pt-16">
            <UpNext items={upNext} />
            {category && (
              <Link
                to={`/collections/${category.slug}`}
                className="mt-6 inline-flex min-h-10 items-center gap-2 font-semibold text-maroon hover:underline"
              >
                <BackIcon className="size-4" />
                Back to {category.name}
                <span className="font-normal text-ink-3">({category.count})</span>
              </Link>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

function WatchNotFound() {
  useSeo({
    title: pageTitle('Video not found'),
    description: 'This video may have moved or is no longer in the catalog.',
    noindex: true,
  })
  return (
    <NotFound
      title="Video not found"
      crumbs={[{ label: 'Browse', to: '/' }, { label: 'Video not found' }]}
      className="mx-auto w-full max-w-[1600px]"
    >
      This video may have moved or is no longer in the catalog. Try one of these instead.
    </NotFound>
  )
}

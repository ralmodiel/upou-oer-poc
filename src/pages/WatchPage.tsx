import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { preconnect } from 'react-dom'
import { Link, useParams } from 'react-router'
import { ChevronRightIcon } from '../components/icons'
import Breadcrumbs, { type Crumb } from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import NotFound from '../components/ui/NotFound'
import { getCategoryByName, getVideo } from '../data/catalog'
import YouTubePlayer, { PlayerPoster } from '../features/player/YouTubePlayer'
import PromoReel from '../features/reel/PromoReel'
import EscHint from '../features/watch/EscHint'
import { BackIcon } from '../features/watch/icons'
import { useInputModality } from '../features/watch/modality'
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
  // The stage is focused by script, so its focus ring waits for keyboard use (see modality.ts).
  const keyboard = useInputModality() === 'keyboard'
  useSeo(videoSeo(video, category))
  for (const origin of ORIGINS) preconnect(origin)

  // Focus the stage (never the YouTube iframe) when the reel starts and again when the player
  // appears, so the app shell's Esc = Back handler keeps receiving key events.
  useEffect(() => {
    stageRef.current?.focus({ preventScroll: true })
  }, [phase])

  // Keys on the stage itself: ↓ steps into its controls (Sound, then Skip), which spatial
  // navigation would pass by for the nearer breadcrumb, and Enter skips the preview, as a
  // remote's OK button should. Anything else is left to the shell.
  const onStageKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.defaultPrevented) return
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    const stage = e.currentTarget
    if (e.key === 'Enter') {
      const skip = stage.querySelector<HTMLButtonElement>('.reel-skip')
      if (!skip) return
      e.preventDefault()
      skip.click()
    } else if (e.key === 'ArrowDown') {
      const control = stage.querySelector('button')
      if (!control) return
      e.preventDefault()
      control.focus()
    }
  }

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
              onKeyDown={onStageKeyDown}
              data-kbd={keyboard || undefined}
              className="watch-stage relative aspect-video overflow-hidden bg-surface shadow-lift ring-1 ring-black/5 md:rounded-card"
            >
              <PlayerPoster video={video} />
              {phase === 'reel' ? (
                <PromoReel video={video} onComplete={startPlayer} />
              ) : (
                <YouTubePlayer video={video} />
              )}
            </div>

            <article className="pt-5">
              <Breadcrumbs items={crumbs} nowrap />
              <h1
                className="watch-title mt-3 font-display text-title text-balance text-ink"
                data-long={video.title.length > LONG_TITLE || undefined}
              >
                {video.title}
              </h1>
              <WatchMeta video={video} />
              {/* Most source pages have none; the meta row and topics carry the facts then. */}
              {video.description && (
                <p className="mt-5 max-w-prose text-base leading-relaxed whitespace-pre-line text-ink-2">
                  {video.description}
                </p>
              )}
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
                More in {category.name}
                <span className="font-normal text-ink-3">({category.count})</span>
                <ChevronRightIcon className="size-4" />
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

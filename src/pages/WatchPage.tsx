import { useEffect, useRef, useState } from 'react'
import { preconnect } from 'react-dom'
import { Link, useParams } from 'react-router'
import { useDocumentTitle } from '../components/hooks'
import Breadcrumbs, { type Crumb } from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import LinkButton from '../components/ui/LinkButton'
import { getCategory, getVideo, similarTo, slugifyCategory } from '../data/catalog'
import YouTubePlayer from '../features/player/YouTubePlayer'
import PromoReel from '../features/reel/PromoReel'
import EscHint from '../features/watch/EscHint'
import { BackIcon } from '../features/watch/icons'
import UpNext from '../features/watch/UpNext'
import WatchMeta from '../features/watch/WatchMeta'
import WatchTags from '../features/watch/WatchTags'
import '../features/watch/watch.css'
import { useGoBack } from '../lib/shortcuts'
import { useWatchHistory } from '../lib/storage'
import type { Video } from '../types'

const ORIGINS = [
  'https://www.youtube-nocookie.com',
  'https://www.youtube.com',
  'https://i.ytimg.com',
]

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
  for (const origin of ORIGINS) preconnect(origin)
  useDocumentTitle(`${video.title} · UPOU Networks`)

  // Focus the stage (never the YouTube iframe) when the reel starts and again when the player
  // appears, so the app shell's Esc = Back handler keeps receiving key events.
  useEffect(() => {
    stageRef.current?.focus({ preventScroll: true })
  }, [phase])

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

  const category = getCategory(slugifyCategory(video.category))
  const upNext = similarTo(video, undefined, 8)
  // Most source pages have no description; say so instead of padding with metadata.
  const about =
    video.description ||
    `No description was published for this video. It is part of ${video.channel}'s ${video.category} collection.`
  const crumbs: Crumb[] = [{ label: 'Browse', to: '/' }]
  if (category) crumbs.push({ label: category.name, to: `/collections/${category.slug}` })
  crumbs.push({ label: video.title })

  return (
    <div className="mx-auto w-full max-w-[1600px] px-(--gutter) pb-16">
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
            aria-label={phase === 'reel' ? 'Promo reel' : 'Video player'}
            onPointerLeave={reclaimFocus}
            className="watch-stage relative aspect-video overflow-hidden bg-surface outline-none ring-1 ring-black/5 focus-visible:ring-2 focus-visible:ring-maroon md:rounded-card"
          >
            {phase === 'reel' ? (
              <PromoReel video={video} onComplete={startPlayer} />
            ) : (
              <YouTubePlayer video={video} />
            )}
          </div>

          <article className="pt-5">
            <Breadcrumbs items={crumbs} />
            <h1 className="mt-3 font-display text-title text-balance text-ink">{video.title}</h1>
            <WatchMeta video={video} category={category} />
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
  )
}

function WatchNotFound() {
  useDocumentTitle('Video not found · UPOU Networks')
  return (
    <section className="mx-auto max-w-md px-(--gutter) py-16 text-center sm:py-24">
      <p className="eyebrow">UPOU Networks</p>
      <h1 className="mt-3 font-display text-title text-ink">Video not found</h1>
      <p className="mt-3 text-ink-2">
        This video may have moved or is no longer in the catalog. Try one of these instead.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <LinkButton to="/" size="sm">
          Browse videos
        </LinkButton>
        <LinkButton to="/collections" variant="secondary" size="sm">
          All collections
        </LinkButton>
        <LinkButton to="/search" variant="secondary" size="sm">
          Search
        </LinkButton>
      </div>
    </section>
  )
}

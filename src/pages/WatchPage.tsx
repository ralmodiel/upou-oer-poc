import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { preconnect } from 'react-dom'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ChevronRightIcon } from '../components/icons'
import Breadcrumbs, { type Crumb } from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import NotFound from '../components/ui/NotFound'
import { toneOf } from '../components/tones'
import { getCategoryByName, getVideo } from '../data/catalog'
import YouTubePlayer, { PlayerPoster } from '../features/player/YouTubePlayer'
import PromoReel from '../features/reel/PromoReel'
import EscHint, { UpNextKeyHint } from '../features/watch/EscHint'
import { BackIcon } from '../features/watch/icons'
import { useInputModality } from '../features/watch/modality'
import AutoplayNext from '../features/watch/AutoplayNext'
import UpNext from '../features/watch/UpNext'
import { useAutoplay, useUpNext } from '../features/watch/useUpNext'
import { withPlaylist, type Playlist } from '../features/watch/recommendations'
import WatchBackdrop, { WatchAmbient } from '../features/watch/WatchBackdrop'
import Speakers from '../features/watch/Speakers'
import WatchCite from '../features/watch/WatchCite'
import WatchDescription from '../features/watch/WatchDescription'
import WatchMeta from '../features/watch/WatchMeta'
import WatchSource from '../features/watch/WatchSource'
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
  // Every video opens on its reel (with no clean image, a type-only title card).
  const [phase, setPhase] = useState<'reel' | 'player'>('reel')
  const goBack = useGoBack()
  const { record } = useWatchHistory()
  const stageRef = useRef<HTMLDivElement>(null)
  const profile = useProfile()
  const upNext = useUpNext(video, profile)
  const [autoplay] = useAutoplay()
  // The video autoplay goes to when this one ends, with the list it belongs to; switching autoplay
  // off drops it, so switching back on does not restart an old countdown.
  const [queued, setQueued] = useState<{ next: Video; playlist: Playlist } | null>(null)
  if (queued && !autoplay) setQueued(null)
  const location = useLocation()
  const navigate = useNavigate()
  const category = getCategoryByName(video.category)
  // The stage is focused by script, so its focus ring waits for keyboard use (see modality.ts).
  const keyboard = useInputModality() === 'keyboard'
  // Focus on the stage or its controls: keyboards and remotes get the → hint for Up next.
  const [onStage, setOnStage] = useState(true)
  // Phones: once the Back row has scrolled away under the header, a small Back stays in reach.
  const backRow = useRef<HTMLDivElement>(null)
  const [backAway, setBackAway] = useState(false)
  useEffect(() => {
    const row = backRow.current
    if (!row || typeof IntersectionObserver !== 'function') return
    const observer = new IntersectionObserver(
      ([entry]) => setBackAway(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: '-64px 0px 0px 0px' },
    )
    observer.observe(row)
    return () => observer.disconnect()
  }, [])
  useSeo(videoSeo(video, category))
  for (const origin of ORIGINS) preconnect(origin)

  // Focus the stage (never the YouTube iframe) when the reel starts and again when the player
  // appears, so the app shell's Esc = Back handler keeps receiving key events. The hand-off leaves
  // focus where it is if the viewer has moved on meanwhile (to Up next, say), and on arrival on the
  // row of Up next chosen by keyboard or remote (UpNext keeps it there).
  const opened = useRef(false)
  useEffect(() => {
    const stage = stageRef.current
    const active = document.activeElement
    const kept = opened.current || active?.closest('.watch-next')
    const away = kept && active && active !== document.body && !stage?.contains(active)
    opened.current = true
    if (!away) stage?.focus({ preventScroll: true })
  }, [phase])

  // Keys on the stage itself: ↓ steps into its controls (Sound, then Skip; on the player its Play /
  // Pause key), which spatial navigation would pass by for the nearer breadcrumb; Enter skips the
  // preview, as a remote's OK button should, and on the player enters its controls; → reaches
  // "Up next" where it sits beside the stage (spatial navigation measures from the stage's left edge
  // and would pick Back). Anything else is left to the shell.
  const onStageKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.defaultPrevented) return
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    const stage = e.currentTarget
    if (e.key === 'Enter') {
      const skip = stage.querySelector<HTMLButtonElement>('.reel-skip')
      const control = stage.querySelector('button')
      if (!skip && !control) return
      e.preventDefault()
      if (skip) skip.click()
      else control?.focus()
    } else if (e.key === 'ArrowDown') {
      const control = stage.querySelector('button')
      if (!control) return
      e.preventDefault()
      control.focus()
    } else if (e.key === 'ArrowRight') {
      const next =
        document.querySelector<HTMLElement>('.watch-next[aria-current="true"]') ??
        document.querySelector<HTMLElement>('.watch-next')
      if (!next || next.getBoundingClientRect().left < stage.getBoundingClientRect().right) return
      e.preventDefault()
      next.focus()
    }
  }

  // ← from a row of Up next beside the stage returns to it, the way → came (spatial navigation would
  // pick the Back button, as the stage is a container rather than a stop).
  const onAsideKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowLeft' || e.defaultPrevented) return
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    const stage = stageRef.current
    const row = e.target instanceof HTMLElement ? e.target.closest('.watch-next') : null
    if (!stage || !row || row.getBoundingClientRect().left < stage.getBoundingClientRect().right)
      return
    e.preventDefault()
    stage.focus()
  }

  const startPlayer = () => {
    setPhase('player')
    record(video.id)
  }

  // Autoplay: the row after this one in the list (the first row when this page is not one of
  // them); at the end of the list the next picks are added first, as More… would.
  const onEnded = () => {
    if (!autoplay) return
    const { items } = upNext
    const at = items.findIndex((i) => i.video.id === video.id)
    let list = items
    let next = items[at + 1]?.video
    if (!next) {
      const added = upNext.append()
      list = [...items, ...added]
      next = added[0]?.video
    }
    if (!next) return
    setQueued({
      next,
      playlist: { from: upNext.asPlaylist().from, ids: list.map((i) => i.video.id) },
    })
  }
  const playNext = () => {
    if (!queued) return
    const state = withPlaylist(location.state, queued.playlist)
    void navigate(`/watch/${queued.next.id}`, { state })
  }
  const cancelNext = () => {
    setQueued(null)
    stageRef.current?.focus({ preventScroll: true })
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
    // At least a screen tall beside the player: Up next no longer lengthens the page there, and a
    // footer in view would move with every late reflow of the column (fonts, for one).
    <div
      className="watch-page pb-16 lg:min-h-dvh"
      data-tone={category ? toneOf(category.slug) : undefined}
    >
      <WatchBackdrop video={video} />
      {/* The gutter already centres the page in 100rem on wide screens (index.css); a max width on
          top of it would take the gutter twice and shrink the player (1280 px of 1920, 640 of 2560). */}
      <div className="w-full px-(--gutter)">
        <div className="lg:grid lg:grid-cols-12 lg:gap-10">
          <div className="watch-main lg:col-span-8">
            <div
              ref={backRow}
              className="watch-back-row flex min-h-14 items-center justify-between gap-3 py-2"
            >
              <Button
                variant="secondary"
                size="sm"
                icon={<BackIcon />}
                onClick={goBack}
                className="watch-back"
              >
                Back
              </Button>
              {keyboard && onStage ? <UpNextKeyHint /> : <EscHint />}
            </div>
            {backAway && (
              <Button
                variant="secondary"
                size="sm"
                icon={<BackIcon />}
                onClick={goBack}
                className="watch-back watch-back-float md:hidden"
              >
                Back
              </Button>
            )}

            {/* The stage over its own ambient light (a wide, neutral blur of its poster). */}
            <div className="watch-stage-wrap">
              <WatchAmbient video={video} />
              <div
                ref={stageRef}
                tabIndex={-1}
                role="region"
                aria-label={phase === 'reel' ? 'Preview' : 'Video player'}
                onPointerLeave={reclaimFocus}
                onKeyDown={onStageKeyDown}
                onFocus={() => setOnStage(true)}
                onBlur={(e) => setOnStage(e.currentTarget.contains(e.relatedTarget))}
                data-kbd={keyboard || undefined}
                className="watch-stage relative aspect-video overflow-hidden bg-surface md:rounded-card"
              >
                <PlayerPoster video={video} />
                {phase === 'reel' ? (
                  <PromoReel video={video} onComplete={startPlayer} />
                ) : (
                  <YouTubePlayer video={video} onEnded={onEnded} />
                )}
                {queued && autoplay && (
                  <AutoplayNext next={queued.next} onPlay={playNext} onCancel={cancelNext} />
                )}
              </div>
            </div>

            <article className="pt-5">
              <Breadcrumbs items={crumbs} nowrap />
              <h1
                className="watch-title mt-3 font-display text-title text-balance text-ink"
                data-long={video.title.length > LONG_TITLE || undefined}
              >
                {video.title}
              </h1>
              <Speakers id={video.id} className="watch-speakers mt-2" />
              <WatchMeta video={video} category={category} />
              {/* How to cite comes first and whole, above the folded description: it matters. */}
              <WatchCite video={video} className="mt-6" />
              {/* Under a gold rule: the description (most source pages have none), then the
                  topics and the source links, each beside a small label. */}
              <div className="watch-about">
                {video.description && <WatchDescription text={video.description} />}
                <WatchTags tags={video.tags} />
                <WatchSource video={video} />
              </div>
            </article>
          </div>

          {/* From lg its gold rule lines up with the top of the stage, beside the Back row. */}
          <aside
            className="watch-aside pt-10 lg:col-span-4 lg:pt-14"
            onKeyDown={onAsideKeyDown}
            onFocus={() => setOnStage(false)}
          >
            <UpNext video={video} list={upNext} />
            {category && (
              <Link to={`/collections/${category.slug}`} className="watch-more mt-5">
                <span>
                  <span className="watch-more-label">More in {category.name}</span>{' '}
                  <span className="font-normal whitespace-nowrap text-ink-3">
                    ({category.count})
                  </span>
                </span>
                <span className="watch-more-icon" aria-hidden="true">
                  <ChevronRightIcon className="size-4" />
                </span>
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
    // Holds the viewport like the route's loading fallback (App.tsx), so the footer never moves
    // into view.
    <NotFound
      title="Video not found"
      crumbs={[{ label: 'Browse', to: '/' }, { label: 'Video not found' }]}
      className="min-h-dvh w-full"
    >
      This video may have moved or is no longer in the catalog. Try one of these instead.
    </NotFound>
  )
}

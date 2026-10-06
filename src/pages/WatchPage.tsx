import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
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
import { candidates, findTarget, focusAndReveal } from '../lib/spatial'
import { useWatchHistory } from '../lib/storage'
import { lite } from '../lib/lite'
import { mayPreload } from '../lib/youtube'
import type { Video } from '../types'

const ORIGINS = [
  'https://www.youtube-nocookie.com',
  'https://www.youtube.com',
  'https://i.ytimg.com',
]
const LONG_TITLE = 120
// How far down counts as scrolled: more than a finger's slip.
const SCROLLED_PX = 24

export default function WatchPage() {
  const { id } = useParams()
  const video = getVideo(id)
  return video ? <Watch key={video.id} video={video} /> : <WatchNotFound />
}

function Watch({ video }: { video: Video }) {
  // Every video opens on its reel (with no clean image, a type-only title card).
  const [phase, setPhase] = useState<'reel' | 'player'>('reel')
  // Lite devices (TVs) load the player at the reveal: a second renderer and its video surfaces
  // behind the 10 s reel cost about 300 MB (GPU and page) on top of the reel's own.
  const [preload] = useState(() => !lite && mayPreload())
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
      // Away above: its top is over the margin's edge (not just over 0: a row that leaves while
      // its top is still on screen, 0 to 8px, is away too).
      ([entry]) =>
        setBackAway(
          !entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0),
        ),
      { rootMargin: '-64px 0px 0px 0px' },
    )
    observer.observe(row)
    return () => observer.disconnect()
  }, [])
  // A page that is scrolled (Back or a reload restored it, or the viewer scrolled during the preview)
  // shows its text and Up next at once: they would be blank for the ten seconds of the preview
  // (watch.css, data-scrolled). Set on the element, so a render never takes it off. The first read
  // waits a microtask, for the router to restore the scroll.
  const page = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const mark = () => {
      if (scrollY < SCROLLED_PX) return
      page.current?.setAttribute('data-scrolled', '')
      removeEventListener('scroll', mark)
    }
    queueMicrotask(mark)
    addEventListener('scroll', mark, { passive: true })
    return () => removeEventListener('scroll', mark)
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
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    const stage = e.currentTarget
    if (e.target !== stage) {
      if (e.target instanceof HTMLElement) leaveStage(e, stage, e.target)
      return
    }
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
      ref={page}
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
                {/* Loads unseen under the preview, so the video starts as it ends (YouTubePlayer). */}
                {(phase === 'player' || preload) && (
                  <YouTubePlayer video={video} onEnded={onEnded} warm={phase === 'reel'} />
                )}
                {phase === 'reel' && <PromoReel video={video} onComplete={startPlayer} />}
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

/**
 * ↑ / ↓ from a control on the stage, out of it. Below lg the stage sticks under the header, and
 * spatial navigation takes it for a pinned bar, from which only what is on screen counts: ↓ with
 * the stage filling a screen on its side found the tab bar (or nothing: the page just scrolled), ↑
 * from the stuck stage found a control scrolled under it and scrolled the page back up to it. ↓
 * goes on to the first control below the stage instead, ↑ to Back. Moves within the stage, and
 * those spatial navigation gets right, are left to it.
 */
function leaveStage(e: KeyboardEvent, stage: HTMLElement, from: HTMLElement) {
  const down = e.key === 'ArrowDown'
  if (!down && e.key !== 'ArrowUp') return
  const target = findTarget(down ? 'down' : 'up', from)
  if (target && stage.contains(target)) return
  const box = stage.getBoundingClientRect()
  const pinned = (el: Element) => el.closest('header, nav[aria-label="Primary"]') !== null
  const below = (el: Element) => el.getBoundingClientRect().top >= box.bottom - 1
  let next: HTMLElement | null | undefined
  if (down) {
    if (target && !pinned(target) && below(target)) return
    next = candidates().find((el) => !stage.contains(el) && !pinned(el) && below(el))
  } else {
    if (!target || target.getBoundingClientRect().bottom <= box.top + 1) return
    next =
      document.querySelector<HTMLElement>('.watch-back-float') ??
      document.querySelector<HTMLElement>('.watch-back')
  }
  if (next && focusAndReveal(next)) e.preventDefault()
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

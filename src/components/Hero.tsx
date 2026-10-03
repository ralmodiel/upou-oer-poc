import { memo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { getVideo, summaryOf } from '../data/catalog'
import { yearOf } from '../lib/format'
import type { Video } from '../types'
import DetailsLink from './DetailsLink'
import PlayLink from './PlayLink'
import { useInView, usePageVisible } from './hooks'
import { InfoIcon, PauseIcon, PlayIcon } from './icons'

// Vary the Ken Burns drift between slides.
const ORIGINS = [
  'origin-center',
  'origin-top-right',
  'origin-bottom-left',
  'origin-top-left',
  'origin-bottom-right',
]

const BUTTON =
  'inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold transition duration-200 ease-cinematic sm:h-12 sm:px-7 sm:text-base lg:text-lg'

function Hero({ videos }: { videos: readonly Video[] }) {
  const [{ index, prev }, setSlide] = useState({ index: 0, prev: -1 })
  const [stopped, setStopped] = useState(false)
  const visible = usePageVisible()
  // Pause the timer and the drift once the hero is mostly scrolled away.
  const [ref, inView] = useInView<HTMLElement>(0.5)
  // ...and while the detail dialog covers it, so its backdrop blur isn't redrawn every frame.
  const [params] = useSearchParams()
  const covered = getVideo(params.get('v')) !== undefined
  const count = videos.length
  const next = (index + 1) % count

  const go = (i: number) => setSlide((s) => (i === s.index ? s : { index: i, prev: s.index }))

  return (
    <section
      ref={ref}
      aria-roledescription="carousel"
      aria-label="Featured titles"
      data-paused={stopped || !visible || !inView || covered || undefined}
      className="hero relative h-[65svh] min-h-[26rem] overflow-hidden sm:h-[75svh] lg:h-[85svh] lg:max-h-[62rem]"
    >
      <div className="absolute inset-0 bg-ink-900">
        {videos.map((video, i) => {
          const active = i === index
          // Mount only the current, outgoing and upcoming images.
          const mounted = active || i === prev || i === next
          return (
            <div
              key={video.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-cinematic motion-reduce:transition-none ${active ? 'opacity-100' : 'opacity-0'}`}
            >
              {mounted && (
                <img
                  src={video.backdrop}
                  alt=""
                  decoding="async"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'low'}
                  className={`size-full object-cover ${active || i === prev ? `ken-burns ${ORIGINS[i % ORIGINS.length]}` : ''}`}
                />
              )}
            </div>
          )
        })}
        <div className="absolute inset-0 bg-linear-to-r from-ink-950/85 via-ink-950/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-ink-950 via-ink-950/60 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-ink-950/70 to-transparent" />
      </div>

      <div className="relative flex h-full flex-col justify-end gap-5 px-(--gutter) pb-20 sm:pb-32 lg:flex-row lg:items-end lg:justify-between lg:pb-44">
        <div className="grid max-w-3xl">
          {videos.map((video, i) => (
            <Slide
              key={video.id}
              video={video}
              active={i === index}
              label={`${i + 1} of ${count}`}
            />
          ))}
        </div>

        {count > 1 && (
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setStopped((s) => !s)}
              aria-label={stopped ? 'Resume slideshow' : 'Pause slideshow'}
              className="grid size-8 place-items-center rounded-full text-white/80 ring-1 ring-white/40 transition hover:text-white hover:ring-white motion-reduce:hidden"
            >
              {stopped ? <PlayIcon className="size-3.5" /> : <PauseIcon className="size-3.5" />}
            </button>
            <div className="flex gap-1">
              {videos.map((video, i) => (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show ${video.title}`}
                  aria-current={i === index}
                  className="group/pill grid h-6 w-8 place-items-center"
                >
                  <span
                    className={`relative block h-1 w-full overflow-hidden rounded-full transition-colors group-hover/pill:bg-white/60 ${i === index ? 'bg-white/45' : 'bg-white/25'}`}
                  >
                    {i === index && (
                      <span
                        className="hero-progress absolute inset-0 origin-left rounded-full bg-white"
                        onAnimationEnd={() => go(next)}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default memo(Hero)

function Slide({ video, active, label }: { video: Video; active: boolean; label: string }) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      inert={!active}
      className={`col-start-1 row-start-1 self-end transition-[opacity,translate] duration-700 ease-cinematic motion-reduce:transition-none ${active ? 'opacity-100' : 'translate-y-3 opacity-0'}`}
    >
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-neutral-200 uppercase sm:text-sm">
        <span aria-hidden="true" className="h-4 w-1 rounded-full bg-brand-500" />
        {video.featured ? 'Featured' : video.category}
      </p>
      <h2 className="line-clamp-3 text-[clamp(1.75rem,3.6vw+1rem,4.5rem)] leading-[1.02] font-black tracking-tight text-balance text-white text-shadow-lg">
        {video.title}
      </h2>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-neutral-300 sm:text-base">
        <span className="font-semibold text-gold-400">{yearOf(video.publishedAt)}</span>
        {/* The kicker already names the category for non-featured slides. */}
        {video.featured && (
          <>
            <span aria-hidden="true">·</span>
            <span>{video.category}</span>
          </>
        )}
      </p>
      <p className="mt-3 line-clamp-2 max-w-xl text-sm text-neutral-200 text-shadow-md sm:line-clamp-3 sm:text-base lg:text-lg">
        {summaryOf(video)}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <PlayLink video={video} className={`${BUTTON} bg-white text-ink-950 hover:bg-neutral-200`}>
          <PlayIcon className="size-5 sm:size-6" />
          Play
        </PlayLink>
        <DetailsLink
          id={video.id}
          className={`${BUTTON} bg-neutral-500/40 text-white backdrop-blur-sm hover:bg-neutral-500/30`}
        >
          <InfoIcon className="size-5 sm:size-6" />
          More Info
        </DetailsLink>
      </div>
    </div>
  )
}

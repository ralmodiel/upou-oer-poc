import { useEffect, useId, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { getVideo, similarTo, summaryOf } from '../data/catalog'
import { formatDate, yearOf } from '../lib/format'
import { watchUrl } from '../lib/youtube'
import type { Video } from '../types'
import MyListButton from './MyListButton'
import PlayLink from './PlayLink'
import VideoGrid from './VideoGrid'
import { DetailsContext, wasOpenedInApp } from './details'
import { prefersReducedMotion, useDocumentTitle } from './hooks'
import { CloseIcon, ExternalLinkIcon, PlayIcon } from './icons'

// Matches the data-closing transition in browse.css.
const EXIT_MS = 200

/** Detail dialog driven by `?v=<id>`; unknown ids render nothing. */
export default function DetailModal() {
  const [params] = useSearchParams()
  const video = getVideo(params.get('v'))
  return video ? <DetailDialog video={video} /> : null
}

function DetailDialog({ video }: { video: Video }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closing = useRef(false)
  const exitTimer = useRef(0)
  const pressedBackdrop = useRef(false)
  const titleId = useId()
  const navigate = useNavigate()
  const { search, state } = useLocation()

  const base = useMemo(() => {
    const params = new URLSearchParams(search)
    params.delete('v')
    return params.toString()
  }, [search])
  // Similar titles swap in place, so Back and close still land on the page underneath.
  const target = useMemo(() => ({ base, replace: true, state }), [base, state])
  const similar = useMemo(() => similarTo(video), [video])

  useLayoutEffect(() => {
    const el = dialog.current
    if (!el) return
    closing.current = false
    if (!el.open) el.showModal()
    // Runs before the node is removed (close button, Back, links): a native close
    // returns focus to the element that opened the dialog. Its `close` event arrives later,
    // possibly after a StrictMode remount reopened the dialog; onClose ignores it then.
    return () => {
      closing.current = true
      clearTimeout(exitTimer.current)
      el.close()
    }
  }, [])

  useEffect(() => {
    dialog.current?.scrollTo({ top: 0 })
  }, [video.id])

  useDocumentTitle(`${video.title} · UPOU Networks`)

  // Close natively first (focus returns to the trigger), so we never navigate with it open.
  const leave = () => {
    dialog.current?.close()
    if (wasOpenedInApp(state)) navigate(-1)
    else navigate({ search: base }, { replace: true, preventScrollReset: true })
  }

  const close = () => {
    if (closing.current) return
    closing.current = true
    const el = dialog.current
    if (!el?.open || prefersReducedMotion()) {
      leave()
      return
    }
    el.dataset.closing = ''
    exitTimer.current = window.setTimeout(leave, EXIT_MS)
  }

  return (
    <dialog
      ref={dialog}
      data-details=""
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Escape: run the exit animation instead of closing at once.
        e.preventDefault()
        close()
      }}
      onClose={() => {
        // Stale event from an earlier close while the dialog is open again: ignore it.
        if (!dialog.current?.open) close()
      }}
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) close()
      }}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-y-auto overscroll-contain border-0 bg-transparent p-0 text-neutral-100 outline-none backdrop:bg-ink-950/75 backdrop:backdrop-blur-sm sm:py-8"
    >
      <div className="relative mx-auto min-h-full w-full overflow-hidden bg-ink-900 shadow-2xl shadow-black/60 sm:min-h-0 sm:w-[min(56rem,calc(100%-3rem))] sm:rounded-xl sm:ring-1 sm:ring-white/10 motion-safe:transition-[opacity,scale,translate] motion-safe:duration-300 motion-safe:ease-cinematic motion-safe:starting:translate-y-6 motion-safe:starting:opacity-0 sm:motion-safe:starting:translate-y-0 sm:motion-safe:starting:scale-95">
        <div className="relative aspect-video bg-ink-800">
          <img
            key={video.id}
            src={video.backdrop}
            alt=""
            decoding="async"
            className="size-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-ink-900 via-ink-900/30 to-transparent" />
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-ink-950/70 text-white ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-ink-950 hover:ring-white/60 sm:top-4 sm:right-4"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div className="relative -mt-12 px-5 pb-10 sm:-mt-24 sm:px-10">
          <h2
            id={titleId}
            className="text-2xl leading-tight font-black tracking-tight text-balance text-white text-shadow-lg sm:text-4xl"
          >
            {video.title}
          </h2>
          <div className="mt-4 flex items-center gap-3">
            <PlayLink
              video={video}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-white px-6 font-semibold text-ink-950 transition hover:bg-neutral-200"
            >
              <PlayIcon className="size-5" />
              Play
            </PlayLink>
            <MyListButton
              id={video.id}
              title={video.title}
              className="size-11"
              iconClassName="size-5"
            />
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_15rem] md:gap-10">
            <div>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-300">
                <span className="font-semibold text-gold-400">{yearOf(video.publishedAt)}</span>
                <span aria-hidden="true">·</span>
                <span className="rounded border border-white/25 px-1.5 py-0.5 text-xs">
                  {video.category}
                </span>
              </p>
              <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-neutral-200 sm:text-base">
                {summaryOf(video)}
              </p>
            </div>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-neutral-400">Published</dt>
                <dd className="mt-0.5 text-neutral-200">
                  <time dateTime={video.publishedAt}>{formatDate(video.publishedAt)}</time>
                </dd>
              </div>
              <div>
                <dt className="text-neutral-400">Channel</dt>
                <dd className="mt-0.5 text-neutral-300">{video.channel}</dd>
              </div>
              {video.tags.length > 0 && (
                <div>
                  <dt className="text-neutral-400">Tags</dt>
                  <dd className="mt-2 flex flex-wrap gap-1.5">
                    {video.tags.map((tag) => (
                      <Link
                        key={tag}
                        to={`/search?q=${encodeURIComponent(tag)}`}
                        title={tag}
                        className="max-w-full truncate rounded-full bg-white/5 px-2.5 py-1 text-xs text-neutral-200 ring-1 ring-white/15 transition hover:bg-brand-600/25 hover:text-white hover:ring-brand-400"
                      >
                        {tag}
                      </Link>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <ExternalLink href={watchUrl(video.youtubeId)}>Watch on YouTube</ExternalLink>
            {/^https?:\/\//.test(video.sourceUrl) && (
              <ExternalLink href={video.sourceUrl}>View on UPOU Networks</ExternalLink>
            )}
          </div>

          {similar.length > 0 && (
            <section
              aria-labelledby={`${titleId}-similar`}
              className="mt-10 border-t border-white/10 pt-8"
            >
              <h3 id={`${titleId}-similar`} className="text-lg font-bold text-white sm:text-xl">
                More Like This
              </h3>
              <div className="mt-4">
                <DetailsContext value={target}>
                  <VideoGrid videos={similar} layout="compact" />
                </DetailsContext>
              </div>
            </section>
          )}
        </div>
      </div>
    </dialog>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-10 items-center gap-2 rounded-md bg-white/10 px-4 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20"
    >
      {children}
      <ExternalLinkIcon className="size-4 text-neutral-400" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

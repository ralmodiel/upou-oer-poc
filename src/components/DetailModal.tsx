import { useEffect, useId, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { getVideo, similarTo, summaryOf } from '../data/catalog'
import { formatDate } from '../lib/format'
import { watchUrl } from '../lib/youtube'
import type { Video } from '../types'
import MyListButton from './MyListButton'
import PlayLink from './PlayLink'
import VideoGrid from './VideoGrid'
import { TEXT_LINK } from './browse-ui'
import { DetailsContext, wasOpenedInApp } from './details'
import { prefersReducedMotion, useDocumentTitle } from './hooks'
import { CloseIcon, ExternalLinkIcon, PlayIcon } from './icons'
import { largeImageOf, slugOfCategory, srcSetOf } from './media'
import Chip from './ui/Chip'
import IconButton from './ui/IconButton'
import { buttonClass } from './ui/button-styles'
import './browse.css'

// Matches the data-closing transition in browse.css.
const EXIT_MS = 200
const SIMILAR = 6

/** Quick look dialog driven by `?v=<id>`; unknown ids render nothing. */
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
  const similar = useMemo(() => similarTo(video, undefined, SIMILAR), [video])

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

  const sourceUrl = /^https?:\/\//.test(video.sourceUrl) ? video.sourceUrl : undefined

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
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-y-auto overscroll-contain border-0 bg-transparent p-0 text-ink outline-none backdrop:bg-overlay md:py-10"
    >
      <div className="relative mx-auto min-h-full w-full bg-surface md:min-h-0 md:w-[min(64rem,calc(100%-3rem))] md:rounded-card md:border md:border-line md:shadow-lift motion-safe:transition-[opacity,scale,translate] motion-safe:duration-250 motion-safe:ease-out-soft motion-safe:starting:translate-y-6 motion-safe:starting:opacity-0 md:motion-safe:starting:translate-y-0 md:motion-safe:starting:scale-[0.98]">
        <IconButton
          label="Close"
          icon={<CloseIcon />}
          variant="secondary"
          onClick={close}
          className="absolute top-3 right-3 z-10 md:top-4 md:right-4"
        />

        <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 md:grid-cols-12 md:grid-rows-[auto_auto_1fr] md:p-8">
          <div className="-mx-5 -mt-5 min-w-0 md:col-span-5 md:col-start-1 md:row-start-1 md:m-0">
            <img
              key={video.id}
              src={largeImageOf(video)}
              srcSet={srcSetOf(video)}
              sizes="(min-width: 48rem) 400px, 100vw"
              alt=""
              decoding="async"
              className="aspect-video w-full bg-surface-2 object-cover md:rounded-card md:ring-1 md:ring-black/5"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 md:col-span-5 md:col-start-1 md:row-start-2">
            <PlayLink video={video} className={buttonClass('primary')}>
              <PlayIcon />
              Play
            </PlayLink>
            <MyListButton
              id={video.id}
              title={video.title}
              className={buttonClass(
                'secondary',
                'md',
                'aria-pressed:border-maroon aria-pressed:text-maroon',
              )}
            />
          </div>

          <div className="min-w-0 md:col-span-7 md:col-start-6 md:row-span-3 md:row-start-1 md:pr-8">
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-3">
              <Link
                to={`/collections/${slugOfCategory(video.category)}`}
                className="eyebrow hover:underline"
              >
                {video.category}
              </Link>
              <span aria-hidden="true">·</span>
              <time dateTime={video.publishedAt}>{formatDate(video.publishedAt)}</time>
              {video.channel !== 'UP Open University' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{video.channel}</span>
                </>
              )}
            </p>
            <h2
              id={titleId}
              className="mt-2 font-display text-2xl leading-tight text-balance text-ink sm:text-3xl"
            >
              {video.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed whitespace-pre-line text-ink-2">
              {summaryOf(video)}
            </p>
            {video.tags.length > 0 && (
              <ul role="list" aria-label="Tags" className="mt-5 flex flex-wrap gap-2">
                {video.tags.map((tag) => (
                  <li key={tag}>
                    <Chip
                      to={`/search?q=${encodeURIComponent(tag)}`}
                      active={false}
                      title={tag}
                      className="h-8 px-3 text-xs"
                    >
                      {tag}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm md:col-span-5 md:col-start-1 md:row-start-3 md:self-start">
            <ExternalLink href={watchUrl(video.youtubeId)}>Watch on YouTube</ExternalLink>
            {sourceUrl && <ExternalLink href={sourceUrl}>View on UPOU Networks</ExternalLink>}
          </div>
        </div>

        {similar.length > 0 && (
          <section
            aria-labelledby={`${titleId}-similar`}
            className="border-t border-line p-5 md:px-8 md:py-7"
          >
            <h3 id={`${titleId}-similar`} className="font-display text-xl text-ink sm:text-2xl">
              More like this
            </h3>
            <div className="mt-4">
              <DetailsContext value={target}>
                <VideoGrid videos={similar} layout="compact" />
              </DetailsContext>
            </div>
          </section>
        )}
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
      className={`inline-flex items-center gap-1.5 ${TEXT_LINK}`}
    >
      {children}
      <ExternalLinkIcon className="size-4" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

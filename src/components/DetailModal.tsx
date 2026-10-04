import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { getVideo } from '../data/catalog'
import { useProfile } from '../lib/history'
import { topicTags } from '../lib/tags'
import { watchUrl } from '../lib/youtube'
import type { Video } from '../types'
import Backdrop from './Backdrop'
import MyListButton from './MyListButton'
import PlayLink from './PlayLink'
import Thumbnail from './Thumbnail'
import VideoGrid from './VideoGrid'
import { useFrozen } from './browse-hooks'
import { FactsLine, LONG_TITLE, TEXT_LINK } from './browse-ui'
import { DetailsContext, wasOpenedInApp } from './details'
import { prefersReducedMotion, useDocumentTitle } from './hooks'
import { CloseIcon, ExternalLinkIcon, PlayIcon } from './icons'
import { stopPreview } from './preview'
import { CardReasons, moreLikeThis, reasonsFor } from './recs'
import Chip from './ui/Chip'
import IconButton from './ui/IconButton'
import { PRESSED, buttonClass } from './ui/button-styles'
import './browse.css'

// Matches the data-closing transition in browse.css.
const EXIT_MS = 200
const SIMILAR = 6
// Soft glow of the video's still behind the image column, gone by the time the text starts.
const SCRIM = 'bg-linear-to-b from-surface/40 via-surface/80 via-60% to-surface'

/** Quick look dialog driven by `?v=<id>`; unknown ids render nothing. */
function focusPageTitle() {
  const title = document.querySelector<HTMLElement>('main h1') ?? document.getElementById('main')
  if (!title) return
  if (!title.hasAttribute('tabindex')) title.tabIndex = -1
  title.focus({ preventScroll: true })
}

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
  // The taste profile as of this title: saving a card below must not reshuffle the grid.
  const profile = useFrozen(useProfile(), video.id)
  const similar = useMemo(() => moreLikeThis(video, { profile, limit: SIMILAR }), [video, profile])
  // Why each one is here, in place of the collection eyebrow.
  const reasons = useMemo(() => reasonsFor(similar, profile, video), [similar, profile, video])
  const tags = useMemo(() => topicTags(video.tags), [video])

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

  // Each title (the first and any similar one swapped in) starts on its still, grown: Enter
  // plays at once, ↓ reaches Play (over-entry), and OK never lands on Close by surprise.
  useEffect(() => {
    stopPreview()
    dialog.current?.scrollTo({ top: 0 })
    dialog.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
  }, [video.id])

  useDocumentTitle(`${video.title} · UPOU OER`)

  // Close natively first (focus returns to the trigger), so we never navigate with it open.
  const leave = () => {
    const el = dialog.current
    el?.close()
    // Opened from a shared link there is no trigger to return focus to (it stays on the closed
    // dialog's button, or the body): start on the page title.
    const active = document.activeElement
    if (!active || active === document.body || el?.contains(active)) focusPageTitle()
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
  const long = video.title.length > LONG_TITLE

  // Tab wraps inside the dialog, so focus never lands on the dialog element or the page.
  const trapTab = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Tab') return
    const stops = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(
        'a[href], button, input, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.tabIndex >= 0 && !el.closest('[inert], [hidden]'))
    if (!stops.length) return
    const first = stops[0]
    const last = stops[stops.length - 1]
    const target = e.target as HTMLElement
    if (!e.shiftKey && (target === last || target === e.currentTarget)) {
      e.preventDefault()
      first.focus()
    } else if (e.shiftKey && (target === first || target === e.currentTarget)) {
      e.preventDefault()
      last.focus()
    }
  }

  return (
    <dialog
      ref={dialog}
      data-details=""
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={trapTab}
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
      <div className="relative isolate mx-auto min-h-full w-full overflow-hidden bg-surface md:min-h-0 md:w-[min(64rem,calc(100%-3rem))] md:rounded-card md:border md:border-line md:shadow-lift motion-safe:transition-[opacity,scale,translate] motion-safe:duration-250 motion-safe:ease-out-soft motion-safe:starting:translate-y-6 motion-safe:starting:opacity-0 md:motion-safe:starting:translate-y-0 md:motion-safe:starting:scale-[0.98]">
        <Backdrop video={video} scrim={SCRIM} className="bottom-auto h-80 md:h-96" />
        <IconButton
          label="Close"
          icon={<CloseIcon />}
          variant="secondary"
          onClick={close}
          className="absolute top-3 right-3 z-10 md:top-4 md:right-4"
        />

        <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 md:grid-cols-12 md:grid-rows-[auto_auto_1fr] md:gap-y-7 md:p-8 lg:gap-x-10">
          {/* The still plays too, and grows while focused or hovered (TV style) into the gutters
              around it, so nothing else moves. The wrapper scales: a focused link drops its
              transition (index.css). Phones: full bleed, no growth. */}
          <div className="-mx-5 -mt-5 min-w-0 md:col-span-5 md:col-start-1 md:row-start-1 md:m-0 md:motion-safe:transition-[scale] md:motion-safe:duration-300 md:motion-safe:ease-out-soft md:motion-safe:hover:scale-108 md:motion-safe:has-[a:focus]:scale-108 lg:col-span-6">
            <PlayLink
              video={video}
              aria-label={`Play ${video.title}`}
              data-autofocus=""
              data-spatial="over-entry"
              className="relative block max-md:focus-visible:outline-none max-md:focus-visible:after:absolute max-md:focus-visible:after:inset-0 max-md:focus-visible:after:shadow-[inset_0_0_0_3px_var(--color-focus)] md:rounded-card"
            >
              <Thumbnail
                video={video}
                sizes="(min-width: 64rem) 470px, (min-width: 48rem) 260px, 100vw"
                large
                canonical
                loading="eager"
                className="md:rounded-card md:shadow-lift md:ring-1 md:ring-black/10"
              />
            </PlayLink>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:col-span-5 md:col-start-1 md:row-start-2 lg:col-span-6">
            <PlayLink video={video} data-spatial="entry" className={buttonClass('primary')}>
              <PlayIcon />
              Play
            </PlayLink>
            <MyListButton
              id={video.id}
              title={video.title}
              className={buttonClass('secondary', 'md', PRESSED)}
            />
          </div>

          <div className="min-w-0 md:col-span-7 md:col-start-6 md:row-span-3 md:row-start-1 md:pr-8 lg:col-span-6 lg:col-start-7">
            <h2
              id={titleId}
              className={`font-display leading-tight text-balance text-ink ${
                long ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
              }`}
            >
              {video.title}
            </h2>
            <FactsLine video={video} className="mt-3" />
            {video.description && (
              <p className="mt-4 text-base leading-relaxed whitespace-pre-line text-ink-2">
                {video.description}
              </p>
            )}
            {tags.length > 0 && (
              <ul
                role="list"
                aria-label="Topics"
                data-spatial="group"
                className="mt-5 flex flex-wrap gap-2"
              >
                {tags.map((tag) => (
                  <li key={tag}>
                    <Chip
                      to={`/search?q=${encodeURIComponent(tag)}`}
                      active={false}
                      title={tag}
                      size="sm"
                    >
                      {tag}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm md:col-span-5 md:col-start-1 md:row-start-3 md:self-start lg:col-span-6">
            <ExternalLink href={watchUrl(video.youtubeId)}>Watch on YouTube</ExternalLink>
            {sourceUrl && <ExternalLink href={sourceUrl}>View on oer.upou.edu.ph</ExternalLink>}
          </div>
        </div>

        {similar.length > 0 && (
          <section
            aria-labelledby={`${titleId}-similar`}
            className="border-t border-line p-5 md:px-8 md:py-7"
          >
            <span aria-hidden="true" className="mb-3 block h-1 w-10 rounded-pill bg-band-gold" />
            <h3 id={`${titleId}-similar`} className="font-display text-xl text-ink sm:text-2xl">
              More like this
            </h3>
            <div className="mt-4">
              <DetailsContext value={target}>
                <CardReasons value={reasons}>
                  <VideoGrid videos={similar} layout="compact" />
                </CardReasons>
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
      className={`relative inline-flex min-h-10 items-center gap-1.5 ${TEXT_LINK}`}
    >
      {children}
      <ExternalLinkIcon className="size-4" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

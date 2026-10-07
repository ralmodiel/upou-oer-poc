import { useEffect, useEffectEvent, useId, useRef, useState, type SyntheticEvent } from 'react'
import { useLocation } from 'react-router'
import { PlayIcon, RestartIcon } from '../../components/icons'
import { thumbnailOf, zoomStyle } from '../../components/media'
import { TitleTile } from '../../components/Thumbnail'
import { cropZoomOf } from '../../data/frameFlags'
import { STAGE_SIZES } from '../../data/images'
import {
  forgetPosition,
  readPosition,
  readPrefs,
  resumeAllowed,
  savePosition,
  startsOver,
} from '../../lib/storage'
import { embedUrl, isYouTubeId, watchUrl } from '../../lib/youtube'
import type { Video } from '../../types'
import { reelImages } from '../reel/stills'
import './player.css'

// React renders it (a boolean attribute); its types do not list it yet.
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- merging needs the same parameter
  interface IframeHTMLAttributes<T> {
    credentialless?: boolean
  }
}

const ALLOW = 'autoplay; encrypted-media; picture-in-picture; clipboard-write; web-share'
const PLAYER_ORIGIN = 'https://www.youtube-nocookie.com'
// The embed's widget messages (enablejsapi=1) report its state, with no YouTube script: 0 ended,
// 1 playing, 2 paused, 3 buffering. Commands go back the same way.
const LISTENING = JSON.stringify({ event: 'listening', id: 1, channel: 'widget' })
const LISTEN_EVERY_MS = 250
const LISTEN_TRIES = 120
// Playback an end needs after the last one counted: a seek near the end can report "ended", play
// on for a moment and end again, which would restart a countdown the viewer just cancelled.
const REPLAY_MS = 2000
// While it plays, where it is gets saved this often (and on pause, on leaving, when hidden).
const SAVE_EVERY_MS = 5000
// How long "Resumed at 1:15 · Start over" stays, counted again once focus or the pointer leaves it.
const RESUMED_MS = 8000
// A player loaded behind the preview is told to play this often once revealed, until it does. If
// it has not started (or begun buffering) within START_MS, it loads afresh with autoplay instead.
const RETRY_MS = 500
const START_MS = 1500
const command = (func: 'playVideo' | 'pauseVideo' | 'seekTo' | 'unMute', args: unknown[] = []) =>
  JSON.stringify({ event: 'command', func, args, id: 1, channel: 'widget' })

type Message = { event?: unknown; info?: unknown }

/** A widget message, parsed, if `data` is one. */
function messageOf(data: unknown): Message | undefined {
  let message: unknown = data
  if (typeof data === 'string') {
    try {
      message = JSON.parse(data)
    } catch {
      return undefined
    }
  }
  return message && typeof message === 'object' ? message : undefined
}

/** The player state a widget message reports, if any. */
function stateOf({ event, info }: Message): number | undefined {
  const state =
    event === 'onStateChange'
      ? info
      : event === 'infoDelivery' && info && typeof info === 'object'
        ? (info as { playerState?: unknown }).playerState
        : undefined
  return typeof state === 'number' ? state : undefined
}

/** Whole seconds played and the video's length, as far as an info delivery reports them. */
function timeOf({ event, info }: Message): { at?: number; length?: number } {
  if (event !== 'infoDelivery' || !info || typeof info !== 'object') return {}
  const { currentTime, duration } = info as { currentTime?: unknown; duration?: unknown }
  const at =
    typeof currentTime === 'number' && currentTime >= 0 ? Math.floor(currentTime) : undefined
  // The length rounds, as the embed's own clock shows it.
  const length = typeof duration === 'number' && duration > 0 ? Math.round(duration) : undefined
  return { at, length }
}

/** 75 → "1:15", 3725 → "1:02:05". */
function clockOf(s: number): string {
  const two = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(s / 3600)
  const m = Math.floor(s / 60) % 60
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`
}

/**
 * The player's first frame: the poster in its own colours, on paper. The stage keeps it under the
 * reel as well, so the reel's closing move lands on it and the swap has nothing to load. With no
 * clean image (every candidate flagged) the video's least bad picture stands in, as on its card,
 * never a plain colour tile. A still that fails to load gives way to its 320px version; only when
 * that fails too does the title tile sit on the paper, so the stage is never dark or blank. Black
 * bars baked into the still are zoomed out of the frame, as on its card and the reel's end card.
 */
export function PlayerPoster({ video }: { video: Video }) {
  const [tries, setTries] = useState(0)
  const { poster } = reelImages(video)
  const picture = thumbnailOf(video, true)
  // The shared poster takes no srcset, so the reel's end card hands over the very same image.
  const sources = [
    poster ? { src: poster } : { src: picture.large, srcSet: picture.srcSet },
    { src: picture.small },
  ]
  const source = sources[tries]
  const fail = () => setTries((n) => n + 1)
  // YouTube answers a missing still with a 120px placeholder. A real one fades in (watch.css).
  // The source that loaded, so the stage's reel can dissolve into it (watch.css): an attribute on
  // this box, which the reel follows as a sibling, costs far less to match than a :has() on the stage.
  const [shown, setShown] = useState<string | null>(null)
  const check = (e: SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth <= 120) return fail()
    e.currentTarget.dataset.loaded = ''
    setShown(e.currentTarget.getAttribute('src'))
  }
  if (!isYouTubeId(video.youtubeId)) return null
  return (
    <div
      data-poster-loaded={(source && shown === source.src) || undefined}
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#faf8f6]"
      aria-hidden="true"
    >
      {source ? (
        <img
          key={tries}
          src={source.src}
          srcSet={source.srcSet}
          sizes={source.srcSet ? STAGE_SIZES : undefined}
          alt=""
          fetchPriority="high"
          onLoad={check}
          onError={fail}
          style={zoomStyle(cropZoomOf(source.src))}
          className="watch-poster size-full object-cover"
        />
      ) : (
        <div className="absolute inset-[20%] overflow-hidden rounded-card shadow-(--shadow-lift)">
          <TitleTile video={video} />
        </div>
      )}
    </div>
  )
}

/**
 * Privacy-enhanced YouTube embed that fills the 16:9 stage, fading in over the poster. It never
 * takes focus by itself: the watch page keeps focus on the stage so Esc = Back keeps working. For
 * keyboards and remotes, the stage's own Play / Pause key (shown only while focused) drives the
 * video through the embed's messages, so focus never has to go into the iframe.
 *
 * `warm` loads it behind the preview: unseen, inert, without its controls, saving nothing. It
 * starts muted (muted autoplay needs no activation), and on its first frame is paused, put back at
 * its start and unmuted, so its first seconds and the rest of YouTube's code are loaded while the
 * preview plays (unmuting only once revealed would buffer again, about a second). When `warm` turns
 * false it is played, and shows only once it plays: the poster stays until the first frame.
 *
 * With "Remember where I stopped" off (the default) the frame is `credentialless` (Chrome and Edge
 * 110+): it sends no cookies and its storage goes with the page, so YouTube's player keeps nothing
 * in this browser. Where a browser lacks it, the warm player is not primed but only loaded, paused,
 * since a muted start makes YouTube store more than a loaded player does.
 */
export default function YouTubePlayer({
  video,
  onEnded,
  warm = false,
}: {
  video: Video
  /** Called when the video plays to its end. */
  onEnded?: () => void
  /** Loading behind the preview, not yet shown. */
  warm?: boolean
}) {
  const { state: navState } = useLocation()
  // Where this browser left the video, read once: the embed starts there (`start`), unless the page
  // was opened to play it from the start.
  const [resumeAt] = useState(() =>
    startsOver(navState, video.id) ? undefined : readPosition(video.id),
  )
  // "Resumed at …" shows once the player answers, until RESUMED_MS pass or Start over.
  const [resumed, setResumed] = useState(resumeAt !== undefined)
  const [holding, setHolding] = useState(false)
  const resumeNoteId = useId()
  const resumeRef = useRef<HTMLDivElement>(null)
  const keyRef = useRef<HTMLButtonElement>(null)
  const [loaded, setLoaded] = useState(false)
  // "Remember where I stopped", read once: on, the player may keep its own data in this browser.
  const [keepData] = useState(() => resumeAllowed(readPrefs()))
  // Primed (a muted start behind the preview) only where what that start stores is kept by choice,
  // or goes with the page (a credentialless frame).
  const mayPrime = keepData || 'credentialless' in HTMLIFrameElement.prototype
  // Mounted warm: primed muted and paused (or, where it may not be, just loaded), so it has to be
  // told to play.
  const [primed, setPrimed] = useState(warm)
  // A primed player has played since it was revealed.
  const [started, setStarted] = useState(false)
  // A primed player has been paused, put back and unmuted.
  const heldRef = useRef(false)
  // The player is ready (onReady, or a state it reports): it takes commands.
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<number | undefined>()
  // Whole seconds, so the many deliveries a second bring a re-render at most once a second.
  const [at, setAt] = useState(0)
  const [length, setLength] = useState<number | undefined>()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const ended = useEffectEvent(() => onEnded?.())
  const live = useEffectEvent(() => !warm)
  const stateNow = useEffectEvent(() => state)
  const playing = state === 1 || state === 3
  const shown = loaded && !warm && (!primed || started)
  const resumedClock = resumeAt === undefined ? '' : clockOf(resumeAt)
  // Once the player answers, and only for a place inside the video (YouTube starts a `start` past
  // the end at 0).
  const showResumed =
    !warm && resumed && resumeAt !== undefined && length !== undefined && resumeAt < length

  useEffect(() => {
    if (!showResumed || holding) return
    const timer = setTimeout(() => setResumed(false), RESUMED_MS)
    return () => clearTimeout(timer)
  }, [showResumed, holding])

  // Says "listening" until the player first answers, then follows its state (and its end).
  useEffect(() => {
    const player = frameRef.current?.contentWindow
    if (!loaded || !player) return
    let answered = false
    let tries = 0
    const listen = () => {
      if (answered || ++tries > LISTEN_TRIES) clearInterval(timer)
      else player.postMessage(LISTENING, PLAYER_ORIGIN)
    }
    const timer = setInterval(listen, LISTEN_EVERY_MS)
    listen()
    // An end counts once, however often it is reported (a state change, then the next info
    // delivery), and the next one only after real playback (REPLAY_MS): a cancelled countdown
    // stays cancelled until the video is played again.
    let last: number | undefined
    let since = 0
    let played = Infinity
    // Where it is, as the player last said, for savePosition (which keeps nothing under 10 s, so a
    // player that has not reached its `start` yet changes nothing).
    let place: number | undefined
    let total: number | undefined
    let savedAt = -Infinity
    const keep = () => {
      if (place !== undefined && live()) savePosition(video.id, place, total)
    }
    const keepIfHidden = () => {
      if (document.visibilityState === 'hidden') keep()
    }
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== PLAYER_ORIGIN || e.source !== player) return
      answered = true
      const message = messageOf(e.data)
      if (!message) return
      if (message.event === 'onReady' || stateOf(message) !== undefined) setReady(true)
      const time = timeOf(message)
      if (time.at !== undefined) {
        place = time.at
        setAt(place)
      }
      if (time.length !== undefined) {
        total = time.length
        setLength(total)
      }
      if (place !== undefined && performance.now() - savedAt >= SAVE_EVERY_MS) {
        savedAt = performance.now()
        keep()
      }
      const next = stateOf(message)
      if (next === undefined || next === last) return
      setState(next)
      // Primed: held at its start until revealed, then shown as it plays.
      if (next === 1 && !live()) {
        player.postMessage(command('pauseVideo'), PLAYER_ORIGIN)
        player.postMessage(command('seekTo', [resumeAt ?? 0, true]), PLAYER_ORIGIN)
        player.postMessage(command('unMute'), PLAYER_ORIGIN)
        heldRef.current = true
      } else if (next === 1) setStarted(true)
      if (next === 2) keep()
      // Played to the end: the next play starts fresh.
      if (next === 0) {
        place = undefined
        forgetPosition(video.id)
      }
      if (last === 1) played += performance.now() - since
      if (next === 1) since = performance.now()
      if (next === 0 && played >= REPLAY_MS) {
        played = 0
        ended()
      }
      last = next
    }
    window.addEventListener('message', onMessage)
    window.addEventListener('pagehide', keep)
    document.addEventListener('visibilitychange', keepIfHidden)
    return () => {
      clearInterval(timer)
      window.removeEventListener('message', onMessage)
      window.removeEventListener('pagehide', keep)
      document.removeEventListener('visibilitychange', keepIfHidden)
      keep()
    }
  }, [loaded, video.id, resumeAt])

  const send = (message: string) =>
    frameRef.current?.contentWindow?.postMessage(message, PLAYER_ORIGIN)

  // Revealed: a primed player is played once ready (unmuted first, if revealed before its first
  // frame), and asked again until it plays.
  // Still not started (nor buffering) after START_MS, it reloads as an unprimed player, with
  // autoplay, so preloading never costs the automatic start.
  useEffect(() => {
    if (!primed || warm || !ready) return
    const player = frameRef.current?.contentWindow
    const since = performance.now()
    const tick = () => {
      const now = stateNow()
      if (now === 1) {
        clearInterval(timer)
        setStarted(true)
      } else if (performance.now() - since < START_MS) {
        player?.postMessage(command('playVideo'), PLAYER_ORIGIN)
      } else if (now !== 3) {
        clearInterval(timer)
        setPrimed(false)
        setLoaded(false)
        setReady(false)
      }
    }
    if (!heldRef.current) player?.postMessage(command('unMute'), PLAYER_ORIGIN)
    const timer = setInterval(tick, RETRY_MS)
    tick()
    return () => clearInterval(timer)
  }, [primed, warm, ready])
  // Back to 0:00. Focus in the note goes on to the Play / Pause key, as the note leaves.
  const startOver = () => {
    send(command('seekTo', [0, true]))
    if (resumeRef.current?.contains(document.activeElement))
      keyRef.current?.focus({ preventScroll: true })
    setResumed(false)
  }

  if (!isYouTubeId(video.youtubeId)) {
    return (
      <p className="absolute inset-0 grid place-items-center bg-[#faf8f6] p-6 text-center text-[#373637]">
        <span>
          This video can't be played here.{' '}
          <a
            href={watchUrl(video.youtubeId)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Try YouTube
          </a>
        </span>
      </p>
    )
  }

  // Warm and not primed, it loads paused and waits to be played.
  const src = `${embedUrl(video.youtubeId, !primed || mayPrime)}${primed && mayPrime ? '&mute=1' : ''}&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}${resumeAt ? `&start=${resumeAt}` : ''}`
  return (
    <>
      {!shown && !warm && (
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 size-10 -translate-1/2 animate-spin motion-reduce:animate-none rounded-full border-[3px] border-white/30 border-t-amber bg-[#1b1a17]/40"
        />
      )}
      <iframe
        ref={frameRef}
        src={src}
        title={`${video.title} (YouTube video)`}
        allow={ALLOW}
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        credentialless={!keepData}
        onLoad={() => setLoaded(true)}
        inert={warm}
        aria-hidden={warm || undefined}
        className={`absolute inset-0 size-full border-0 transition-opacity duration-700 ${shown ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* Said once to screen readers; the note's own text is for the eyes and describes its button. */}
      <p role="status" className="sr-only">
        {showResumed && `Resumed at ${resumedClock}`}
      </p>
      {/* Before the key, so ↓ or Enter on the stage reaches Start over while it shows (WatchPage). */}
      {showResumed && (
        <div className="player-resume-layer">
          <div
            ref={resumeRef}
            className="player-resumed"
            onFocus={() => setHolding(true)}
            onBlur={(e) => setHolding(e.currentTarget.contains(e.relatedTarget))}
            onPointerEnter={() => setHolding(true)}
            onPointerLeave={() => setHolding(false)}
          >
            <span id={resumeNoteId} aria-hidden="true" className="player-resumed-at">
              Resumed at {resumedClock}
            </span>
            <button
              type="button"
              className="player-start-over"
              aria-describedby={resumeNoteId}
              onClick={startOver}
            >
              <RestartIcon />
              Start over
            </button>
          </div>
        </div>
      )}
      {/* The key and, beside it while it has focus, the time and how far along (seen only). */}
      {/* Paused or ended: Up next's Now playing bars hold still (watch.css). */}
      {!warm && (
        <div className="watch-player-keys" data-paused={state === 2 || state === 0 || undefined}>
          <button
            ref={keyRef}
            type="button"
            className="watch-player-key"
            onClick={() => send(command(playing ? 'pauseVideo' : 'playVideo'))}
          >
            {playing ? <PauseIcon /> : <PlayIcon className="size-4" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          {length !== undefined && (
            <span className="watch-player-time" aria-hidden="true">
              {clockOf(Math.min(at, length))} / {clockOf(length)}
              <span className="watch-player-track">
                <span style={{ scale: `${Math.min(at / length, 1)} 1` }} />
              </span>
            </span>
          )}
        </div>
      )}
    </>
  )
}

const PauseIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    className="size-4"
  >
    <rect x="3" y="2" width="3.5" height="12" rx="1" />
    <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
  </svg>
)

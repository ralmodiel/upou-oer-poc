import { useEffect, useEffectEvent, useRef, useState, type SyntheticEvent } from 'react'
import { PlayIcon } from '../../components/icons'
import { thumbnailOf, zoomStyle } from '../../components/media'
import { TitleTile } from '../../components/Thumbnail'
import { cropZoomOf } from '../../data/frameFlags'
import { STAGE_SIZES } from '../../data/images'
import { embedUrl, isYouTubeId, watchUrl } from '../../lib/youtube'
import type { Video } from '../../types'
import { reelImages } from '../reel/stills'

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
const command = (func: 'playVideo' | 'pauseVideo') =>
  JSON.stringify({ event: 'command', func, args: [], id: 1, channel: 'widget' })

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
  const check = (e: SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth <= 120) fail()
    else e.currentTarget.dataset.loaded = ''
  }
  if (!isYouTubeId(video.youtubeId)) return null
  return (
    <div
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
 */
export default function YouTubePlayer({
  video,
  onEnded,
}: {
  video: Video
  /** Called when the video plays to its end. */
  onEnded?: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [state, setState] = useState<number | undefined>()
  // Whole seconds, so the many deliveries a second bring a re-render at most once a second.
  const [at, setAt] = useState(0)
  const [length, setLength] = useState<number | undefined>()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const ended = useEffectEvent(() => onEnded?.())
  const playing = state === 1 || state === 3

  // Says "listening" until the player first answers, then follows its state (and its end).
  useEffect(() => {
    const player = frameRef.current?.contentWindow
    if (!loaded || !player) return
    let heard = false
    let tries = 0
    const listen = () => {
      if (heard || ++tries > LISTEN_TRIES) clearInterval(timer)
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
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== PLAYER_ORIGIN || e.source !== player) return
      heard = true
      const message = messageOf(e.data)
      if (!message) return
      const time = timeOf(message)
      if (time.at !== undefined) setAt(time.at)
      if (time.length !== undefined) setLength(time.length)
      const next = stateOf(message)
      if (next === undefined || next === last) return
      setState(next)
      if (last === 1) played += performance.now() - since
      if (next === 1) since = performance.now()
      if (next === 0 && played >= REPLAY_MS) {
        played = 0
        ended()
      }
      last = next
    }
    window.addEventListener('message', onMessage)
    return () => {
      clearInterval(timer)
      window.removeEventListener('message', onMessage)
    }
  }, [loaded])

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

  return (
    <>
      {!loaded && (
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 size-10 -translate-1/2 animate-spin motion-reduce:animate-none rounded-full border-[3px] border-white/30 border-t-amber bg-[#1b1a17]/40"
        />
      )}
      <iframe
        ref={frameRef}
        src={`${embedUrl(video.youtubeId)}&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
        title={`${video.title} (YouTube video)`}
        allow={ALLOW}
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 size-full border-0 transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* The key and, beside it while it has focus, the time and how far along (seen only). */}
      <div className="watch-player-keys">
        <button
          type="button"
          className="watch-player-key"
          onClick={() =>
            frameRef.current?.contentWindow?.postMessage(
              command(playing ? 'pauseVideo' : 'playVideo'),
              PLAYER_ORIGIN,
            )
          }
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

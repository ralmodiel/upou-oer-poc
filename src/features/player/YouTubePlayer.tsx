import { useEffect, useEffectEvent, useRef, useState, type SyntheticEvent } from 'react'
import { TitleTile } from '../../components/Thumbnail'
import { embedUrl, isYouTubeId, watchUrl } from '../../lib/youtube'
import type { Video } from '../../types'
import { reelImages } from '../reel/stills'

const ALLOW = 'autoplay; encrypted-media; picture-in-picture; clipboard-write; web-share'
const PLAYER_ORIGIN = 'https://www.youtube-nocookie.com'
// The embed's widget messages (enablejsapi=1) tell when the video ends, with no YouTube script.
const LISTENING = JSON.stringify({ event: 'listening', id: 1, channel: 'widget' })
const LISTEN_EVERY_MS = 250
const LISTEN_TRIES = 120

/** Whether a widget message from the player says the video has ended (state 0). */
function isEndedMessage(data: unknown): boolean {
  let message: unknown = data
  if (typeof data === 'string') {
    try {
      message = JSON.parse(data)
    } catch {
      return false
    }
  }
  if (!message || typeof message !== 'object') return false
  const { event, info } = message as { event?: unknown; info?: unknown }
  if (event === 'onStateChange') return info === 0
  if (event !== 'infoDelivery' || !info || typeof info !== 'object') return false
  return (info as { playerState?: unknown }).playerState === 0
}

/**
 * The player's first frame: the poster in its own colours, on paper. The stage keeps it under the
 * reel as well, so the reel's closing move lands on it and the swap has nothing to load. With no
 * safe image (every candidate flagged) or a missing one, the title tile sits on the paper instead:
 * never a dark or blank stage.
 */
export function PlayerPoster({ video }: { video: Video }) {
  const [failed, setFailed] = useState(false)
  const { poster } = reelImages(video)
  // YouTube answers a missing still with a 120px placeholder.
  const check = (e: SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth <= 120) setFailed(true)
  }
  if (!isYouTubeId(video.youtubeId)) return null
  return (
    <div className="pointer-events-none absolute inset-0 bg-[#faf8f6]" aria-hidden="true">
      {poster && !failed ? (
        <img
          src={poster}
          alt=""
          onLoad={check}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <div className="absolute inset-[20%] overflow-hidden rounded-card shadow-lift">
          <TitleTile video={video} />
        </div>
      )}
    </div>
  )
}

/**
 * Privacy-enhanced YouTube embed that fills the 16:9 stage, fading in over the poster. It never
 * takes focus by itself: the watch page keeps focus on the stage so Esc = Back keeps working.
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
  const frameRef = useRef<HTMLIFrameElement>(null)
  const ended = useEffectEvent(() => onEnded?.())

  // Says "listening" until the player first answers, then watches its messages for the end.
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
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== PLAYER_ORIGIN || e.source !== player) return
      heard = true
      if (isEndedMessage(e.data)) ended()
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
          className="absolute top-1/2 left-1/2 size-10 -translate-1/2 animate-spin rounded-full border-[3px] border-white/30 border-t-amber bg-[#1b1a17]/40"
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
    </>
  )
}

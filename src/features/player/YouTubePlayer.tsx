import { useEffect, useRef, useState } from 'react'
import { embedUrl, isYouTubeId, watchUrl } from '../../lib/youtube'
import type { Video } from '../../types'

const ALLOW = 'autoplay; encrypted-media; picture-in-picture; clipboard-write; web-share'

/** Privacy-enhanced YouTube embed, fitted (contain) to the viewport. */
export default function YouTubePlayer({ video }: { video: Video }) {
  const [loaded, setLoaded] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const playable = isYouTubeId(video.youtubeId)

  // Keep focus on the stage when the reel's Skip button unmounts.
  useEffect(() => {
    boxRef.current?.focus({ preventScroll: true })
  }, [])

  const onLoad = () => {
    setLoaded(true)
    // Hand keyboard control to the player unless the user has moved focus.
    if (document.activeElement === boxRef.current) frameRef.current?.focus()
  }

  return (
    <div className="absolute inset-0 grid place-items-center bg-black">
      <div
        ref={boxRef}
        tabIndex={-1}
        role="region"
        aria-label={`Video player: ${video.title}`}
        className="relative aspect-video w-[min(100vw,177.78dvh)] outline-none"
      >
        {/* Stays under the iframe so the player fades in over it, matching the reel's last frame. */}
        {playable && (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <img src={video.backdrop} alt="" className="size-full object-cover opacity-50" />
            {!loaded && (
              <span className="absolute top-1/2 left-1/2 size-12 -translate-1/2 animate-spin rounded-full border-[3px] border-white/20 border-t-brand-500" />
            )}
          </div>
        )}
        {playable ? (
          <iframe
            ref={frameRef}
            src={embedUrl(video.youtubeId)}
            title={`${video.title} (YouTube video)`}
            allow={ALLOW}
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={onLoad}
            className={`absolute inset-0 size-full border-0 transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <p className="absolute inset-0 grid place-items-center p-6 text-center text-neutral-300">
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
        )}
      </div>
    </div>
  )
}

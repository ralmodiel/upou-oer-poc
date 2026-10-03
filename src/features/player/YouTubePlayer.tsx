import { useState } from 'react'
import { embedUrl, isYouTubeId, watchUrl } from '../../lib/youtube'
import type { Video } from '../../types'

const ALLOW = 'autoplay; encrypted-media; picture-in-picture; clipboard-write; web-share'

/**
 * Privacy-enhanced YouTube embed that fills the 16:9 stage. It never takes focus by itself:
 * the watch page keeps focus on the stage so Esc = Back keeps working.
 */
export default function YouTubePlayer({ video }: { video: Video }) {
  const [loaded, setLoaded] = useState(false)
  const playable = isYouTubeId(video.youtubeId)

  return (
    <div className="absolute inset-0 bg-[#1b1a17] text-[#faf8f6]">
      {/* Stays under the iframe so the player fades in over it, matching the reel's last frame. */}
      {playable && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <img src={video.backdrop} alt="" className="size-full object-cover opacity-50" />
          {!loaded && (
            <span className="absolute top-1/2 left-1/2 size-10 -translate-1/2 animate-spin rounded-full border-[3px] border-white/20 border-t-amber" />
          )}
        </div>
      )}
      {playable ? (
        <iframe
          src={embedUrl(video.youtubeId)}
          title={`${video.title} (YouTube video)`}
          allow={ALLOW}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 size-full border-0 transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        <p className="absolute inset-0 grid place-items-center p-6 text-center">
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
  )
}

import { heroImageOf } from '../../components/media'
import { useState } from 'react'
import { embedUrl, isYouTubeId, watchUrl } from '../../lib/youtube'
import type { Video } from '../../types'

const ALLOW = 'autoplay; encrypted-media; picture-in-picture; clipboard-write; web-share'

/**
 * The player's first frame: the backdrop at half strength over night. The stage keeps it under
 * the reel as well, so the reel's closing move lands on it and the swap has nothing to load.
 */
export function PlayerPoster({ video }: { video: Video }) {
  if (!isYouTubeId(video.youtubeId)) return null
  return (
    <div className="pointer-events-none absolute inset-0 bg-[#1b1a17]" aria-hidden="true">
      <img src={heroImageOf(video)} alt="" className="size-full object-cover opacity-50" />
    </div>
  )
}

/**
 * Privacy-enhanced YouTube embed that fills the 16:9 stage, fading in over the poster. It never
 * takes focus by itself: the watch page keeps focus on the stage so Esc = Back keeps working.
 */
export default function YouTubePlayer({ video }: { video: Video }) {
  const [loaded, setLoaded] = useState(false)

  if (!isYouTubeId(video.youtubeId)) {
    return (
      <p className="absolute inset-0 grid place-items-center bg-[#1b1a17] p-6 text-center text-[#faf8f6]">
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
          className="absolute top-1/2 left-1/2 size-10 -translate-1/2 animate-spin rounded-full border-[3px] border-white/20 border-t-amber"
        />
      )}
      <iframe
        src={embedUrl(video.youtubeId)}
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

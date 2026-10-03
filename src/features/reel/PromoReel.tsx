import {
  Fragment,
  memo,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { usePersistentState } from '../../lib/storage'
import type { Video } from '../../types'
import { createReelAudio, type ReelAudio } from './audio'
import { createClock, type Clock } from './clock'
import { SkipIcon, SoundOffIcon, SoundOnIcon } from './icons'
import { buildReelPlan, END_AT, INDEX_STYLES, SHOT_AT, TICK_STYLES, type ReelPlan } from './plan'
import { DECODE_CAP_MS, settleImages } from './preload'
import './reel.css'

export const REEL_MS = 10_000

const LETTERS = [...'UPOUNETWORKS'].map((char, i) => ({
  char,
  i,
  style: { '--i': i } as CSSProperties,
}))
// Light leaks sweep across the ident→montage and montage→end-card cuts.
const LEAKS = [SHOT_AT[0] - 350, END_AT - 550].map((at) => ({ '--d': `${at}ms` }) as CSSProperties)

interface Stills {
  key: string
  shots: (string | null)[]
  backdrop: string | null
}

interface Props {
  video: Video
  onComplete: () => void
}

/** Ten-second promo generated from the video's data; calls `onComplete` once when done or skipped. */
export default function PromoReel({ video, onComplete }: Props) {
  const plan = useMemo(() => buildReelPlan(video), [video])
  const style = useMemo(
    () => ({ ...plan.style, '--reel-ms': `${REEL_MS}ms` }) as CSSProperties,
    [plan],
  )
  const [loaded, setLoaded] = useState<Stills | null>(null)
  const [soundOn, setSoundOn] = usePersistentState('upou:reel-sound', true)
  const rootRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<ReelAudio | null>(null)
  const clockRef = useRef<Clock | null>(null)
  const doneRef = useRef(false)
  const stills = loaded?.key === video.id ? loaded : null
  const started = stills !== null

  const complete = () => {
    if (doneRef.current) return
    doneRef.current = true
    audioRef.current?.dispose()
    onComplete()
  }
  const onTimeUp = useEffectEvent(complete)
  const soundWanted = useEffectEvent(() => soundOn)

  // Sound is set up while the stills decode: starting an AudioContext can stall the main thread.
  useEffect(() => {
    const audio = createReelAudio(plan.rootHz, () => clockRef.current?.elapsed() ?? 0)
    audioRef.current = audio
    audio.setMuted(!soundWanted())
    return () => {
      audio.dispose()
      audioRef.current = null
    }
  }, [plan])

  // Decode the stills (capped) before the clock starts; failures fall back to the backdrop or a gradient.
  useEffect(() => {
    let live = true
    const srcs = [video.backdrop, ...plan.shots.map((s) => s.src)]
    void settleImages(srcs, DECODE_CAP_MS).then(([backdropOk, ...shotOk]) => {
      if (!live) return
      const fallback = backdropOk ? video.backdrop : null
      setLoaded({
        key: video.id,
        shots: plan.shots.map((s, i) => (shotOk[i] ? s.src : fallback)),
        backdrop: fallback ?? plan.shots.find((_, i) => shotOk[i])?.src ?? null,
      })
    })
    return () => {
      live = false
    }
  }, [video, plan])

  // One timer drives completion; animations, timer and audio pause together while the tab is hidden.
  useEffect(() => {
    const root = rootRef.current
    const audio = audioRef.current
    if (!started || !root || !audio) return
    const clock = createClock(REEL_MS, () => onTimeUp())
    clockRef.current = clock
    let running = false
    let disposed = false
    const sync = () => {
      const hidden = document.hidden
      root.toggleAttribute('data-paused', hidden)
      if (hidden) {
        clock.pause()
        audio.pause()
        // Flush styles so the CSS pause lands before the tab stops rendering.
        root.getBoundingClientRect()
      } else if (running) {
        clock.resume()
        audio.resume()
      }
    }
    // Clock and sound follow the CSS timeline: its start time is only known once it is ready,
    // and by then it may already have run a few frames, so the clock catches up first.
    const timeline = root.querySelector('.reel-progress')?.getAnimations?.({ subtree: true })[0]
    const begin = () => {
      if (disposed) return
      running = true
      clock.advance(Number(timeline?.currentTime) || 0)
      sync()
      audio.begin()
    }
    // On direct page loads audio starts suspended; a first press on the reel can unlock it.
    const unlock = () => audio.resume()
    sync()
    if (timeline) timeline.ready.then(begin, () => {})
    else begin()
    document.addEventListener('visibilitychange', sync)
    root.addEventListener('pointerdown', unlock)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', sync)
      root.removeEventListener('pointerdown', unlock)
      clock.pause()
      clockRef.current = null
    }
  }, [started])

  useEffect(() => {
    audioRef.current?.setMuted(!soundOn)
  }, [soundOn])

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label={`Promo reel: ${video.title}`}
      className="reel"
      data-template={plan.template}
      data-side={plan.side}
      data-motion={plan.motion}
      data-end={plan.ending}
      style={style}
    >
      {stills ? (
        <Timeline plan={plan} video={video} stills={stills} />
      ) : (
        <div className="reel-loading" role="status">
          <span className="sr-only">Loading promo</span>
        </div>
      )}
      <div className="reel-controls">
        <button
          type="button"
          className="reel-sound"
          aria-label={soundOn ? 'Mute promo sound' : 'Unmute promo sound'}
          onClick={() => setSoundOn((on) => !on)}
        >
          {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
        </button>
        <button type="button" className="reel-skip" onClick={complete} autoFocus>
          Skip Intro
          <SkipIcon />
        </button>
      </div>
    </div>
  )
}

// Static once mounted: the CSS timeline runs without React re-rendering it.
const Timeline = memo(function Timeline({
  plan,
  video,
  stills,
}: {
  plan: ReelPlan
  video: Video
  stills: Stills
}) {
  return (
    <>
      <div className="reel-stage">
        {plan.shots.map((shot, i) => (
          <div key={i} className="reel-shot" style={shot.style}>
            <div className="reel-tx" data-tx={shot.tx}>
              <div className="reel-kb">
                {stills.shots[i] && <img src={stills.shots[i]} alt="" draggable={false} />}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="reel-frame" />
      <div className="reel-shade" />
      <div className="reel-bars" />
      <p className="reel-index" aria-hidden="true">
        <span className="reel-index-now">
          {INDEX_STYLES.map((s, i) => (
            <span key={i} style={s}>{`0${i + 1}`}</span>
          ))}
        </span>
        <span>/ 03</span>
      </p>

      <div className="reel-copy">
        <div className="reel-titleblock" style={plan.titleStyle}>
          {plan.kicker && (
            <p className="reel-kicker" style={plan.kickerStyle}>
              {plan.kicker}
            </p>
          )}
          <p className="reel-title" aria-hidden="true">
            {plan.lines.map((line, li) => (
              <span
                key={li}
                className="reel-line"
                data-outline={line.outline || undefined}
                style={line.style}
              >
                {line.words.map((word, wi) => (
                  <Fragment key={wi}>
                    {(li > 0 || wi > 0) && ' '}
                    <span
                      className={word.hot ? 'reel-word is-hot' : 'reel-word'}
                      style={word.style}
                    >
                      <span>{word.text}</span>
                    </span>
                  </Fragment>
                ))}
              </span>
            ))}
          </p>
        </div>
        <div className="reel-story" style={plan.storyStyle}>
          {plan.hook && (
            <p className="reel-hook" style={plan.hookStyle}>
              <span>{plan.hook}</span>
            </p>
          )}
          {plan.tags.length > 0 && (
            <ul className="reel-tags" aria-label="Topics">
              {plan.tags.map((tag) => (
                <li key={tag.text} style={tag.style}>
                  {tag.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="reel-ident">
        <span className="reel-ident-glow" />
        <p className="reel-wordmark">
          <span className="reel-ident-block" />
          <span className="sr-only">UPOU Networks</span>
          <span className="reel-wm" aria-hidden="true">
            {[LETTERS.slice(0, 4), LETTERS.slice(4)].map((word, wi) => (
              <span key={wi} className={wi ? 'reel-wm-b' : 'reel-wm-a'}>
                {word.map((l) => (
                  <span key={l.i} style={l.style}>
                    {l.char}
                  </span>
                ))}
              </span>
            ))}
          </span>
        </p>
        <span className="reel-streak" />
        <p className="reel-ident-sub">{plan.identLine}</p>
      </div>

      <div className="reel-end">
        <div className="reel-end-poster">
          <div className="reel-end-art">
            {stills.backdrop && <img src={stills.backdrop} alt="" draggable={false} />}
          </div>
        </div>
        <div className="reel-end-copy">
          <p className="reel-eyebrow">
            <span className="reel-live" aria-hidden="true" />
            Now playing
          </p>
          <h2 className="reel-end-title">{video.title}</h2>
          <p className="reel-end-meta">{plan.meta}</p>
          <p className="reel-count">
            Starting in
            {TICK_STYLES.map((s, i) => (
              <Fragment key={i}>
                {i > 0 && (
                  <span className="reel-sep" aria-hidden="true">
                    ·
                  </span>
                )}
                <span className="reel-digit" style={s}>
                  {3 - i}
                </span>
              </Fragment>
            ))}
          </p>
        </div>
      </div>

      {LEAKS.map((s, i) => (
        <span key={i} className="reel-leak" style={s} />
      ))}
      <div className="reel-vignette" />
      <div className="reel-grain" />
      <div className="reel-progress" />
    </>
  )
})

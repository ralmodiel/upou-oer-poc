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
import { buildReelPlan, INDEX_STYLES, TICK_STYLES, type ReelPlan } from './plan'
import { DECODE_CAP_MS, settleImages } from './preload'
import { reelImages } from './stills'
import './reel.css'

export const REEL_MS = 10_000
export type ReelVariant = 'full' | 'preview'
// Preview stages up to this wide (CSS px: cards) take the 320px stills whatever the DPR, so a
// hover costs three or four small images; the hero's larger stage gets the big ones.
const CARD_STAGE_PX = 480

// Wordmark letters, indexed across both words so the kinetic ident can drop them in one by one.
const WORDMARK = ['UPOU', 'OER'].map((word, wi, words) => {
  const offset = words.slice(0, wi).join('').length
  return [...word].map((char, i) => ({ char, style: { '--i': offset + i } as CSSProperties }))
})

interface Stills {
  key: string
  shots: (string | null)[]
  backdrop: string | null
}

export interface PromoReelProps {
  video: Video
  /** Called once, when the reel ends or is skipped. */
  onComplete: () => void
  /**
   * `full` (default) is the watch stage: Skip, sound and the end-card countdown.
   * `preview` fits a card's 16:9 box on hover or focus: silent, no controls, lighter effects
   * and type sized for 160–800px stages. Same 10 s timeline, still seeded per video, except
   * that the card's image gives way to the reel at 0.5 s instead of 1.5 s.
   */
  variant?: ReelVariant
  /** Start silent whatever the stored preference (previews always are). */
  muted?: boolean
}

/** Ten-second preview generated from the video's data; calls `onComplete` once when done or skipped. */

// The card image previews open on, never a flagged frame.
const coverOf = (video: Video) => {
  const safe = reelImages(video)
  return safe.thumbnail ?? safe.poster ?? video.thumbnail
}

export default function PromoReel({
  video,
  onComplete,
  variant = 'full',
  muted = false,
}: PromoReelProps) {
  const preview = variant === 'preview'
  const silent = muted || preview
  const plan = useMemo(() => buildReelPlan(video), [video])
  const style = useMemo(
    () => ({ ...plan.style, '--reel-ms': `${REEL_MS}ms` }) as CSSProperties,
    [plan],
  )
  const [loaded, setLoaded] = useState<Stills | null>(null)
  // First visits are silent; stored values may be hand-edited, so only `true` turns sound on.
  const [stored, setStored] = usePersistentState<unknown>('upou:reel-sound', false)
  const soundOn = !silent && stored === true
  const rootRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<ReelAudio | null>(null)
  const clockRef = useRef<Clock | null>(null)
  const doneRef = useRef(false)
  const stills = loaded?.key === video.id ? loaded : null
  const started = stills !== null
  // No face-safe still (callers skip the reel then): nothing to show, so it ends at once.
  const empty = plan.shots.length === 0

  const complete = () => {
    if (doneRef.current) return
    doneRef.current = true
    audioRef.current?.dispose()
    onComplete()
  }
  const onTimeUp = useEffectEvent(complete)
  const soundWanted = useEffectEvent(() => soundOn)

  useEffect(() => {
    if (empty) onTimeUp()
  }, [empty])

  // Sound is set up while the stills decode: starting an AudioContext can stall the main thread.
  useEffect(() => {
    if (silent || empty) return
    const audio = createReelAudio(plan.rootHz, () => clockRef.current?.elapsed() ?? 0)
    audioRef.current = audio
    audio.setMuted(!soundWanted())
    return () => {
      audio.dispose()
      audioRef.current = null
    }
  }, [plan, silent, empty])

  // Decode the stills (capped) before the clock starts; failures fall back to the backdrop or a gradient.
  useEffect(() => {
    if (!plan.shots.length) return
    const controller = new AbortController()
    const small = preview && (rootRef.current?.clientWidth ?? 0) <= CARD_STAGE_PX
    const shots = plan.shots.map((s) => (small ? s.small : s.src))
    // Face-safe images only (frame-flags): the card image for small previews, else the shared poster.
    const safe = reelImages(video)
    const backdrop =
      (small ? (safe.thumbnail ?? safe.poster) : safe.poster) ?? shots[0] ?? video.thumbnail
    void settleImages([backdrop, ...shots], DECODE_CAP_MS, controller.signal).then(
      ([backdropOk, ...shotOk]) => {
        if (controller.signal.aborted) return
        const fallback = backdropOk ? backdrop : null
        setLoaded({
          key: video.id,
          shots: shots.map((src, i) => (shotOk[i] ? src : fallback)),
          backdrop: fallback ?? shots.find((_, i) => shotOk[i]) ?? null,
        })
      },
    )
    return () => controller.abort()
  }, [video, plan, preview])

  // One timer drives completion; animations, timer and audio pause together while the tab is hidden.
  useEffect(() => {
    const root = rootRef.current
    if (!started || !root) return
    const audio = audioRef.current
    const clock = createClock(REEL_MS, () => onTimeUp())
    clockRef.current = clock
    let running = false
    let disposed = false
    const sync = () => {
      const hidden = document.hidden
      root.toggleAttribute('data-paused', hidden)
      if (hidden) {
        clock.pause()
        audio?.pause()
        // Flush styles so the CSS pause lands before the tab stops rendering.
        root.getBoundingClientRect()
      } else if (running) {
        clock.resume()
        audio?.resume()
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
      audio?.begin()
    }
    // On direct page loads audio starts suspended; a first press on the reel can unlock it.
    const unlock = () => audio?.resume()
    sync()
    if (timeline) timeline.ready.then(begin, () => {})
    else begin()
    document.addEventListener('visibilitychange', sync)
    if (audio) root.addEventListener('pointerdown', unlock)
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

  if (empty) return null

  return (
    <div
      ref={rootRef}
      role={preview ? undefined : 'group'}
      aria-label={preview ? undefined : `Preview: ${video.title}`}
      aria-hidden={preview || undefined}
      className="reel"
      data-variant={variant}
      data-template={plan.template}
      data-accent={plan.accent}
      data-side={plan.side}
      data-motion={plan.motion}
      data-end={plan.ending}
      data-unit={plan.unit}
      data-single={plan.single || undefined}
      data-slides={plan.slides || undefined}
      data-lowres={(plan.lowRes && !preview) || undefined}
      style={style}
    >
      {stills ? (
        <Timeline plan={plan} stills={stills} preview={preview} />
      ) : (
        <div className="reel-loading" role={preview ? undefined : 'status'}>
          <img src={coverOf(video)} alt="" draggable={false} />
          {!preview && <span className="sr-only">Loading preview</span>}
        </div>
      )}
      {!preview && (
        <div className="reel-controls">
          {!silent && (
            <button
              type="button"
              className="reel-btn reel-sound"
              aria-pressed={soundOn}
              onClick={() => setStored(!soundOn)}
            >
              {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
              <span>{soundOn ? 'Mute' : 'Unmute'}</span>
            </button>
          )}
          <button type="button" className="reel-btn reel-skip" onClick={complete}>
            <span>Skip preview</span>
            <SkipIcon />
          </button>
        </div>
      )}
    </div>
  )
}

interface TimelineProps {
  plan: ReelPlan
  stills: Stills
  preview: boolean
}

// Static once mounted: the CSS timeline runs without React re-rendering it. The montage is
// decorative for assistive tech; the end card carries the one readable summary.
const Timeline = memo(function Timeline({ plan, stills, preview }: TimelineProps) {
  return (
    <>
      {/* A blurred copy of the shot on screen: beside slides, which show whole, and under the band. */}
      <div className="reel-fill" aria-hidden="true">
        {plan.shots.map(
          (shot, i) =>
            stills.shots[i] && (
              <div key={i} className="reel-fill-shot" style={shot.style}>
                <img src={stills.shots[i]} alt="" draggable={false} />
              </div>
            ),
        )}
      </div>
      <div className="reel-stage" aria-hidden="true">
        {plan.shots.map((shot, i) => (
          <div
            key={i}
            className="reel-shot"
            data-slide={shot.slide || undefined}
            style={shot.style}
          >
            <div className="reel-tx" data-tx={shot.tx}>
              <div className="reel-kb">
                {stills.shots[i] && <img src={stills.shots[i]} alt="" draggable={false} />}
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Previews start on the card's own image and dissolve into the reel half a second in. */}
      {preview && stills.backdrop && (
        <div className="reel-cover" aria-hidden="true">
          <img src={stills.backdrop} alt="" draggable={false} />
        </div>
      )}
      {/* The light band under the picture: the brand, the type and the controls live there. */}
      <div className="reel-band" aria-hidden="true" />
      <div className="reel-rule" aria-hidden="true" />
      {!preview && (
        <p className="reel-index" aria-hidden="true">
          <span className="reel-index-now">
            {INDEX_STYLES.map((s, i) => (
              <span key={i} style={s}>{`0${i + 1}`}</span>
            ))}
          </span>
          <span>/ 03</span>
        </p>
      )}

      <div className="reel-copy" aria-hidden="true">
        <div className="reel-titleblock" style={plan.titleStyle}>
          {plan.kicker && (
            <p className="reel-kicker" style={plan.kickerStyle}>
              {plan.kicker}
            </p>
          )}
          <p className="reel-title">
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
            <ul className="reel-tags">
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
        <p className="reel-wordmark">
          <span className="reel-ident-block" aria-hidden="true" />
          <span className="sr-only">UPOU OER</span>
          <span className="reel-wm" aria-hidden="true">
            {WORDMARK.map((word, wi) => (
              <span key={wi} className={wi ? 'reel-wm-b' : 'reel-wm-a'}>
                {word.map((letter, i) => (
                  <span key={i} style={letter.style}>
                    {letter.char}
                  </span>
                ))}
              </span>
            ))}
          </span>
        </p>
        <span className="reel-streak" aria-hidden="true" />
        <p className="reel-ident-sub">Open Educational Resources</p>
      </div>

      <div className="reel-end">
        <div className="reel-end-poster" aria-hidden="true">
          <div className="reel-end-art">
            {stills.backdrop && <img src={stills.backdrop} alt="" draggable={false} />}
          </div>
        </div>
        <div className="reel-end-copy">
          <p className="reel-eyebrow">
            <span className="reel-live" aria-hidden="true" />
            {preview ? 'Preview' : 'Now playing'}
          </p>
          <p className="reel-end-title">{plan.title}</p>
          <p className="reel-end-meta">
            {plan.meta.map((part, i) => (
              <span key={i}>
                {part}
                {i < plan.meta.length - 1 && ' · '}
              </span>
            ))}
          </p>
          {!preview && (
            <p className="reel-count" role="status">
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
          )}
        </div>
      </div>

      {!preview && (
        <div
          className="reel-progress"
          role="progressbar"
          aria-label="Preview progress"
          aria-valuemin={0}
          aria-valuemax={100}
        />
      )}
    </>
  )
})

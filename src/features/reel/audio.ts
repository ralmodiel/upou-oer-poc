import { END_AT, OUT_AT, SHOT_AT, TICK_AT } from './plan'

const MASTER = 0.18

export interface ReelAudio {
  /** The reel's timeline has started: cues can be queued against it. */
  begin(): void
  setMuted(muted: boolean): void
  pause(): void
  resume(): void
  dispose(): void
}

interface Tone {
  freq: number
  to?: number
  type?: OscillatorType
  peak: number
  attack: number
  decay: number
}

interface Sweep {
  from: number
  to: number
  q: number
  peak: number
  attack: number
  decay: number
}

type Synth = ReturnType<typeof createSynth>
type Cue = [at: number, play: (s: Synth, t: number) => void]

const sec = (ms: number) => ms / 1000

function createSynth(ctx: AudioContext, out: AudioNode) {
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

  const envelope = (t: number, peak: number, attack: number, decay: number) => {
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(peak, t + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
    gain.connect(out)
    return gain
  }

  return {
    tone(t: number, { freq, to, type = 'sine', peak, attack, decay }: Tone) {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.setValueAtTime(freq, t)
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t + attack + decay)
      osc.connect(envelope(t, peak, attack, decay))
      osc.start(t)
      osc.stop(t + attack + decay + 0.05)
    },
    sweep(t: number, { from, to, q, peak, attack, decay }: Sweep) {
      const src = ctx.createBufferSource()
      src.buffer = noise
      src.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.Q.value = q
      filter.frequency.setValueAtTime(from, t)
      filter.frequency.exponentialRampToValueAtTime(to, t + attack + decay)
      src.connect(filter).connect(envelope(t, peak, attack, decay))
      src.start(t)
      src.stop(t + attack + decay + 0.05)
    },
  }
}

function cues(root: number): Cue[] {
  const thump = (s: Synth, t: number, peak: number, decay: number) =>
    s.tone(t, { freq: 140, to: 42, peak, attack: 0.004, decay })
  const swish = (s: Synth, t: number) =>
    s.sweep(t, { from: 500, to: 3200, q: 1.2, peak: 0.12, attack: 0.14, decay: 0.24 })
  const chord: [mult: number, peak: number, decay: number][] = [
    [2, 0.34, 1.7],
    [3, 0.2, 1.5],
    [4, 0.14, 1.3],
    [8, 0.035, 1.1],
  ]
  return [
    // Brand sting: a soft "ta"…
    [
      0.14,
      (s, t) => {
        thump(s, t, 0.7, 0.32)
        s.tone(t, { freq: root * 2, type: 'triangle', peak: 0.42, attack: 0.006, decay: 0.3 })
        s.tone(t, { freq: root * 4, peak: 0.14, attack: 0.006, decay: 0.22 })
      },
    ],
    // …then a warm "dum" chord over a sub thump.
    [
      0.5,
      (s, t) => {
        thump(s, t, 0.95, 0.6)
        for (const [mult, peak, decay] of chord) {
          s.tone(t, {
            freq: root * mult,
            type: mult === 2 ? 'triangle' : 'sine',
            peak,
            attack: 0.012,
            decay,
          })
        }
        s.sweep(t, { from: 2400, to: 700, q: 0.7, peak: 0.06, attack: 0.01, decay: 0.5 })
      },
    ],
    ...SHOT_AT.map((at): Cue => [sec(at) - 0.08, swish]),
    // Riser into the end card, then a soft landing.
    [
      sec(END_AT) - 0.8,
      (s, t) => {
        s.sweep(t, { from: 280, to: 5200, q: 1.6, peak: 0.3, attack: 0.76, decay: 0.12 })
        s.tone(t, { freq: 180, to: 760, peak: 0.045, attack: 0.76, decay: 0.1 })
      },
    ],
    [
      sec(END_AT),
      (s, t) => {
        thump(s, t, 0.9, 0.8)
        s.tone(t, { freq: root * 2, type: 'triangle', peak: 0.22, attack: 0.05, decay: 2.2 })
        s.tone(t, { freq: root * 3, peak: 0.13, attack: 0.08, decay: 2 })
      },
    ],
    [sec(OUT_AT) - 0.1, swish],
    ...TICK_AT.map((at, i): Cue => [
      sec(at),
      (s, t) => s.tone(t, { freq: i === 2 ? 1320 : 990, peak: 0.16, attack: 0.003, decay: 0.09 }),
    ]),
  ]
}

/** Synthesized reel sound. The AudioContext is created on first unmute and stays silent if it can't run. */
export function createReelAudio(rootHz: number, elapsedMs: () => number): ReelAudio {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let begun = false
  let scheduled = false
  let disposed = false

  // Cues are queued once the context actually runs, offset by reel time already elapsed.
  const schedule = () => {
    if (!begun || !ctx || !master || scheduled || ctx.state !== 'running') return
    scheduled = true
    const offset = sec(elapsedMs())
    const now = ctx.currentTime + 0.04
    const synth = createSynth(ctx, master)
    for (const [at, play] of cues(rootHz)) if (at >= offset) play(synth, now + at - offset)
  }

  const start = () => {
    if (ctx || disposed || typeof AudioContext === 'undefined') return
    try {
      ctx = new AudioContext()
    } catch {
      return
    }
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    ctx.addEventListener('statechange', schedule)
    schedule()
  }

  return {
    begin() {
      begun = true
      schedule()
    },
    setMuted(muted) {
      if (!muted) start()
      if (!ctx || !master) return
      if (!muted) ctx.resume().catch(() => {})
      master.gain.setTargetAtTime(muted ? 0 : MASTER, ctx.currentTime, 0.05)
    },
    pause() {
      ctx?.suspend().catch(() => {})
    },
    resume() {
      ctx?.resume().catch(() => {})
    },
    dispose() {
      if (disposed) return
      disposed = true
      const c = ctx
      const m = master
      ctx = null
      master = null
      if (!c || !m) return
      m.gain.setTargetAtTime(0, c.currentTime, 0.02)
      setTimeout(() => void c.close().catch(() => {}), 150)
    },
  }
}

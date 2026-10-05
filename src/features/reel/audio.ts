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

interface Air {
  cutoff: number
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
    air(t: number, { cutoff, peak, attack, decay }: Air) {
      const src = ctx.createBufferSource()
      src.buffer = noise
      src.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = cutoff
      src.connect(filter).connect(envelope(t, peak, attack, decay))
      src.start(t)
      src.stop(t + attack + decay + 0.05)
    },
  }
}

function cues(root: number): Cue[] {
  // A calm, TV-friendly bed: a warm pad that breathes in, a soft chime on each shot, and a gentle
  // resolving chord on the end card. Long attacks, no percussive hits, nothing bright or sharp.
  const pad = (
    s: Synth,
    t: number,
    notes: number[],
    peak: number,
    attack: number,
    decay: number,
  ) => {
    for (const [i, mult] of notes.entries()) {
      // two slightly detuned voices per note give a soft chorus
      for (const detune of [0.997, 1.003])
        s.tone(t, { freq: root * mult * detune, peak: peak / (i + 1.5), attack, decay })
    }
  }
  const chime = (s: Synth, t: number, mult: number) => {
    s.tone(t, { freq: root * mult, peak: 0.075, attack: 0.025, decay: 1.8 })
    s.tone(t, { freq: root * mult * 2, peak: 0.018, attack: 0.025, decay: 1.1 })
  }
  // major pentatonic steps above the root: rising, never resolving early
  const steps = [3, 4, 5]
  return [
    // the bed breathes in under the opening
    [0.05, (s, t) => pad(s, t, [1, 1.5, 2, 3], 0.2, 1.4, 3.2)],
    [0.05, (s, t) => s.air(t, { cutoff: 900, peak: 0.035, attack: 1.6, decay: 2.6 })],
    ...SHOT_AT.map((at, i): Cue => [
      sec(at) - 0.02,
      (s, t) => chime(s, t, steps[i % steps.length]),
    ]),
    // a second, lighter swell carries the middle shots
    [sec(SHOT_AT[1]) - 0.4, (s, t) => pad(s, t, [1, 1.5, 2.25], 0.12, 1.2, 2.8)],
    // the end card settles on a warm major chord
    [sec(END_AT) - 0.3, (s, t) => pad(s, t, [1, 1.25, 1.5, 2], 0.22, 0.6, 2.6)],
    [sec(END_AT), (s, t) => chime(s, t, 4)],
    // the countdown's zero keeps its original swish
    [
      sec(OUT_AT) - 0.1,
      (s, t) => s.sweep(t, { from: 500, to: 3200, q: 1.2, peak: 0.12, attack: 0.14, decay: 0.24 }),
    ],
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

/** A single pausable timeout that tracks how much time is left. */
export function createClock(duration: number, onDone: () => void) {
  let remaining = duration
  let startedAt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let done = false

  const resume = () => {
    if (timer !== undefined || done) return
    startedAt = performance.now()
    timer = setTimeout(() => {
      timer = undefined
      remaining = 0
      done = true
      onDone()
    }, remaining)
  }

  const pause = () => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
    remaining = Math.max(0, remaining - (performance.now() - startedAt))
  }

  /** Moves a paused clock forward, e.g. to catch up with an animation that started earlier. */
  const advance = (ms: number) => {
    if (timer === undefined) remaining = Math.max(0, remaining - ms)
  }

  const elapsed = () =>
    duration - remaining + (timer === undefined ? 0 : performance.now() - startedAt)

  return { resume, pause, advance, elapsed }
}

export type Clock = ReturnType<typeof createClock>

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createClock } from './clock'

afterEach(() => {
  vi.useRealTimers()
})

describe('createClock', () => {
  it('pauses, resumes and catches up without firing twice', () => {
    vi.useFakeTimers()
    const done = vi.fn()
    const clock = createClock(1000, done)

    clock.advance(300)
    clock.resume()
    vi.advanceTimersByTime(200)
    clock.pause()
    expect(clock.elapsed()).toBe(500)

    vi.advanceTimersByTime(5000)
    expect(done).not.toHaveBeenCalled()

    clock.resume()
    vi.advanceTimersByTime(499)
    expect(done).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(done).toHaveBeenCalledTimes(1)

    clock.resume()
    vi.advanceTimersByTime(2000)
    expect(done).toHaveBeenCalledTimes(1)
  })
})

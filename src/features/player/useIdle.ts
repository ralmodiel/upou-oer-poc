import { useEffect, useState } from 'react'

const WAKE_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const

/** True after `ms` without pointer, wheel or keyboard activity. */
export function useIdle(ms: number) {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), ms)
    const wake = () => {
      clearTimeout(timer)
      setIdle(false)
      timer = setTimeout(() => setIdle(true), ms)
    }
    for (const type of WAKE_EVENTS) window.addEventListener(type, wake, { passive: true })
    return () => {
      clearTimeout(timer)
      for (const type of WAKE_EVENTS) window.removeEventListener(type, wake)
    }
  }, [ms])
  return idle
}

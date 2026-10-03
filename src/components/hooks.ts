import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

/** Sets document.title while mounted and restores the previous title afterwards. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}

function subscribeScroll(onChange: () => void) {
  let frame = 0
  const onScroll = () => {
    frame ||= requestAnimationFrame(() => {
      frame = 0
      onChange()
    })
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('scroll', onScroll)
  }
}

/** True once the page is scrolled past `threshold`; re-renders only when that flips. */
export function useScrolledPast(threshold: number) {
  return useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > threshold,
    () => false,
  )
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

export function usePageVisible() {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== 'hidden',
    () => true,
  )
}

/** True while at least `ratio` of the element is on screen; re-renders only when that flips. */
export function useInView<T extends Element>(ratio: number) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.intersectionRatio >= ratio),
      { threshold: ratio },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ratio])
  return [ref, inView] as const
}

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

import { useCallback } from 'react'
import { usePersistentState } from './storage'

export const HOW_IT_WORKS_KEY = 'upou:howitworks'

/** Dismissal of the home-page "How it works" strip; `show()` brings it back (footer "Help"). */
export function useHowItWorks() {
  const [stored, set] = usePersistentState<unknown>(HOW_IT_WORKS_KEY, false)
  const dismiss = useCallback(() => set(true), [set])
  const show = useCallback(() => set(false), [set])
  return { dismissed: stored === true, dismiss, show }
}

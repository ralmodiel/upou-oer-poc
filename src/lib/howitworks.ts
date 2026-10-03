import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { usePersistentState } from './storage'

export const HOW_IT_WORKS_KEY = 'upou:howitworks'
/** Fired by `show()`; a mounted strip moves focus to its heading. */
export const HOW_IT_WORKS_EVENT = 'upou:howitworks'

// Set by `show()` and consumed when the strip mounts (the caller may be on another page).
let focusPending = false
export const takeHowItWorksFocus = () => {
  const pending = focusPending
  focusPending = false
  return pending
}

/** Dismissal of the home-page "How it works" strip; `show()` brings it back (Help links). */
export function useHowItWorks() {
  const [stored, set] = usePersistentState<unknown>(HOW_IT_WORKS_KEY, false)
  const dismiss = useCallback(() => set(true), [set])
  const show = useCallback(() => {
    set(false)
    focusPending = true
    window.dispatchEvent(new Event(HOW_IT_WORKS_EVENT))
  }, [set])
  return { dismissed: stored === true, dismiss, show }
}

/** "Help": re-opens the strip at the top of the home page with focus on its heading. */
export function useHelp() {
  const { show } = useHowItWorks()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return useCallback(() => {
    void navigate('/', { replace: pathname === '/' })
    window.scrollTo({ top: 0 })
    show()
  }, [navigate, pathname, show])
}

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { usePersistentState } from './storage'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_KEY = 'upou:theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'
// Paper colour per theme, mirrored into <meta name="theme-color">.
const CHROME_COLOR: Record<ResolvedTheme, string> = { light: '#faf8f6', dark: '#141112' }

/** The three choices, in display order (controls add their own icons). */
export const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export const isTheme = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system'

export const systemTheme = (): ResolvedTheme =>
  window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'

export const resolveTheme = (theme: Theme): ResolvedTheme =>
  theme === 'system' ? systemTheme() : theme

/** Puts the resolved theme on <html data-theme> and the browser UI colour. */
export function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute('content', CHROME_COLOR[resolved]))
}

/** The stored choice, read without React (for the pre-render bootstrap). */
export function readStoredTheme(): Theme {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(THEME_KEY) ?? 'null')
    return isTheme(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

/** Call before the first render so the page never flashes the wrong theme. */
export const bootstrapTheme = () => applyTheme(resolveTheme(readStoredTheme()))

function subscribeSystem(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Theme choice shared by every caller; `resolved` follows the OS while `theme` is 'system'. */
export function useTheme() {
  const [stored, store] = usePersistentState<unknown>(THEME_KEY, 'system')
  const theme: Theme = isTheme(stored) ? stored : 'system'
  const system = useSyncExternalStore(subscribeSystem, systemTheme, () => 'light' as const)
  const resolved: ResolvedTheme = theme === 'system' ? system : theme

  useEffect(() => applyTheme(resolved), [resolved])

  const setTheme = useCallback((next: Theme) => store(next), [store])
  return { theme, resolved, setTheme }
}

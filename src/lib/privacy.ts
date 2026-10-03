import { historyAllowed, type Prefs } from './storage'

// Opens the Privacy and history panel (PrivacyDialog) from anywhere: Help menu, footer, row links.
export const OPEN_PRIVACY_EVENT = 'upou:open-privacy'

export const openPrivacy = () => window.dispatchEvent(new Event(OPEN_PRIVACY_EVENT))

/** What personal picks may draw on under `prefs`, in words: "watched, searched and saved". */
export function pickSources(prefs: Prefs): string {
  const words = [historyAllowed(prefs) && 'watched', prefs.searches && 'searched', 'saved']
  return words
    .filter(Boolean)
    .join(', ')
    .replace(/, ([^,]+)$/, ' and $1')
}

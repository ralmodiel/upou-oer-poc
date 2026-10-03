// Opens the Privacy and history panel (PrivacyDialog) from anywhere: Help menu, footer, row links.
export const OPEN_PRIVACY_EVENT = 'upou:open-privacy'

export const openPrivacy = () => window.dispatchEvent(new Event(OPEN_PRIVACY_EVENT))

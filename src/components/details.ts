import { createContext } from 'react'

/** How detail links build their URL: search params to keep, history mode and state. */
export interface DetailsTarget {
  base: string
  replace?: boolean
  state?: unknown
}

const OPENED_IN_APP = { detailsFromApp: true }

export const DetailsContext = createContext<DetailsTarget>({ base: '', state: OPENED_IN_APP })

/** Target for pages that keep extra params (e.g. the search query) behind the modal. */
export const pageTarget = (base: string): DetailsTarget => ({ base, state: OPENED_IN_APP })

/** Hash for a quick look that starts on the video's details: title, facts and citation. */
export const AT_DETAILS = '#details'

export function detailsSearch(base: string, id: string) {
  const params = new URLSearchParams(base)
  params.set('v', id)
  return `?${params}`
}

export const wasOpenedInApp = (state: unknown) =>
  typeof state === 'object' && state !== null && 'detailsFromApp' in state

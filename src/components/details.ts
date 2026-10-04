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

/**
 * How far the dialog must scroll for the details' title and the facts line under it to show, with
 * `air` below them (16px; more where a floating pill covers the foot of the view): 0 while they are
 * in view, and never so far that the title leaves the top.
 */
export function detailsShortfall(view: Element, details: Element, air = 16): number {
  const title = details.firstElementChild
  if (!title) return 0
  const box = view.getBoundingClientRect()
  const top = title.getBoundingClientRect().top - box.top
  const bottom = (title.nextElementSibling ?? title).getBoundingClientRect().bottom - box.top
  const short = bottom + air - box.height
  return short > 0 ? Math.max(0, Math.min(short, top - 16)) : 0
}

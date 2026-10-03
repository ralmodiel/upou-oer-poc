import { useSyncExternalStore } from 'react'

export type PointerKind = 'fine' | 'coarse'

// Mouse or trackpad with hover; touch screens and TV remotes are "coarse".
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'

export const hasFinePointer = (): boolean => window.matchMedia(FINE_POINTER_QUERY).matches

function subscribe(onChange: () => void) {
  const query = window.matchMedia(FINE_POINTER_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/**
 * 'fine' on devices where keyboard hints make sense ("press / to search"), 'coarse' on touch
 * screens ("tap Search"). CSS can use the matching `pointer-fine:` variant instead.
 */
export function usePointerKind(): PointerKind {
  return useSyncExternalStore(
    subscribe,
    () => (hasFinePointer() ? 'fine' : 'coarse'),
    () => 'fine',
  )
}

export type InputModality = 'keyboard' | 'pointer'

// The input used last (null before the first press), tracked for the whole visit.
let lastUsed: InputModality | null = null
const notifiers = new Set<() => void>()
const record = (next: InputModality) => () => {
  if (next === lastUsed) return
  lastUsed = next
  notifiers.forEach((notify) => notify())
}
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', record('keyboard'), true)
  window.addEventListener('pointerdown', record('pointer'), true)
}

/** The input used last: a key press or a pointer press; null before either. */
export const lastInput = (): InputModality | null => lastUsed

/**
 * 'keyboard' from the first key press until the next pointer press ('pointer' before any input).
 * Chrome treats focus moved by script as :focus-visible until the first pointer event, so a ring
 * on an element the page focuses itself should also wait for this to say 'keyboard'.
 */
export function useInputModality(): InputModality {
  return useSyncExternalStore(
    (notify) => {
      notifiers.add(notify)
      return () => notifiers.delete(notify)
    },
    () => lastUsed ?? 'pointer',
    () => 'pointer',
  )
}

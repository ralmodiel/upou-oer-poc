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

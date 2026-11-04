import { useSyncExternalStore } from 'react'

/** Primary input cannot hover or point precisely: a phone or tablet, not a narrowed desktop window. */
const coarsePointerQuery = '(hover: none), (pointer: coarse)'

function subscribe(onStoreChange: () => void) {
  const media = window.matchMedia(coarsePointerQuery)
  media.addEventListener('change', onStoreChange)
  return () => media.removeEventListener('change', onStoreChange)
}

function coarsePointer() {
  return window.matchMedia(coarsePointerQuery).matches
}

export function useCoarsePointer() {
  return useSyncExternalStore(subscribe, coarsePointer)
}

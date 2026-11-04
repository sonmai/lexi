import { useSyncExternalStore } from 'react'

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

function subscribe(onStoreChange: () => void) {
  const media = window.matchMedia(reducedMotionQuery)
  media.addEventListener('change', onStoreChange)
  return () => media.removeEventListener('change', onStoreChange)
}

function reducedMotion() {
  return window.matchMedia(reducedMotionQuery).matches
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, reducedMotion)
}

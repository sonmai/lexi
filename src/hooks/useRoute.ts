import { useMemo, useSyncExternalStore } from 'react'
import { containsJapanese } from '../utils/japanese'

export type Mode = 'en' | 'ja'

export interface Route {
  word: string
  mode: Mode
}

function readRoute(): Route {
  const params = new URLSearchParams(window.location.search)
  const word = params.get('q')?.trim() || ''
  return { word, mode: params.get('lang') === 'ja' || containsJapanese(word) ? 'ja' : 'en' }
}

/** Increments on every navigation, including Back/Forward to an identical URL. */
let navigation = 0
const listeners = new Set<() => void>()

function notify() {
  navigation += 1
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  if (!listeners.size) window.addEventListener('popstate', notify)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (!listeners.size) window.removeEventListener('popstate', notify)
  }
}

/** Returns the navigation number of the new route. */
export function navigate(next: Route, push: boolean): number {
  const url = new URL(window.location.href)
  if (next.word) url.searchParams.set('q', next.word)
  else url.searchParams.delete('q')
  if (next.mode === 'ja') url.searchParams.set('lang', 'ja')
  else url.searchParams.delete('lang')
  if (window.location.search !== url.search) {
    url.hash = ''
    if (push) window.history.pushState({}, '', url)
    else window.history.replaceState({}, '', url)
  }
  notify()
  return navigation
}

/** The looked-up word and dictionary, kept in the URL (`?q=…&lang=ja`). */
export function useRoute(): { route: Route; navigation: number } {
  const current = useSyncExternalStore(subscribe, () => navigation)
  const route = useMemo(readRoute, [current])
  return { route, navigation: current }
}

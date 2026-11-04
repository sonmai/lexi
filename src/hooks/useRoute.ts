import { useCallback, useEffect, useState } from 'react'
import { containsJapanese } from '../utils/japanese'

export type Mode = 'en' | 'ja'

export interface Route {
  word: string
  mode: Mode
}

export function readRoute(): Route {
  const params = new URLSearchParams(window.location.search)
  const word = params.get('q')?.trim() || ''
  return { word, mode: params.get('lang') === 'ja' || containsJapanese(word) ? 'ja' : 'en' }
}

/** The looked-up word and dictionary, kept in the URL (`?q=…&lang=ja`) and restored on back/forward. */
export function useRoute(): [Route, (next: Route, push: boolean) => void] {
  const [route, setRoute] = useState(readRoute)

  useEffect(() => {
    const sync = () => setRoute(readRoute())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const navigate = useCallback((next: Route, push: boolean) => {
    const url = new URL(window.location.href)
    if (next.word) url.searchParams.set('q', next.word)
    else url.searchParams.delete('q')
    if (next.mode === 'ja') url.searchParams.set('lang', 'ja')
    else url.searchParams.delete('lang')
    if (window.location.search !== url.search) {
      if (push) window.history.pushState({}, '', url)
      else window.history.replaceState({}, '', url)
    }
    setRoute(next)
  }, [])

  return [route, navigate]
}

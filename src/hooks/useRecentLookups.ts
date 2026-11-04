import { useSyncExternalStore } from 'react'
import type { Mode } from './useRoute'

const STORAGE_KEY = 'lexi-recent-v1'
const LIMIT = 12

type Recent = Record<Mode, string[]>

const listeners = new Set<() => void>()
let cache: Recent | null = null

function read(): Recent {
  if (cache) return cache
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<Recent>
    cache = { en: stored.en ?? [], ja: stored.ja ?? [] }
  } catch {
    cache = { en: [], ja: [] }
  }
  return cache
}

function write(next: Recent) {
  cache = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private browsing or a full quota: keep the list for this session only.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    cache = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Moves a found word to the front of its dictionary's history. */
export function rememberLookup(mode: Mode, word: string) {
  const recent = read()
  if (recent[mode][0] === word) return
  write({ ...recent, [mode]: [word, ...recent[mode].filter((item) => item !== word)].slice(0, LIMIT) })
}

export function clearLookups(mode: Mode) {
  write({ ...read(), [mode]: [] })
}

/** Words looked up in a dictionary on this device, most recent first. */
export function useRecentLookups(mode: Mode): string[] {
  return useSyncExternalStore(subscribe, () => read()[mode])
}

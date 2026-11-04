import { useEffect, useState } from 'react'
import { loadKanjiReadings, type Section } from '../dictionary-service'
import { loadIndex, similarWords, suggestWords } from '../suggest-client'

export interface IndexState {
  status: 'idle' | 'loading' | 'ready' | 'missing' | 'error'
  count: number
  demo: boolean
  error?: string
}

/** Loads a section's suggestion index the first time `enabled` is true. */
export function useDictionaryIndex(section: Section, enabled: boolean): IndexState {
  const [loaded, setLoaded] = useState<IndexState | null>(null)
  const [requested, setRequested] = useState(enabled)
  if (enabled && !requested) setRequested(true)

  useEffect(() => {
    if (!requested) return
    let live = true
    loadIndex(section).then((info) => {
      if (live) setLoaded(info ? { status: 'ready', ...info } : { status: 'missing', count: 0, demo: false })
    }, (error) => {
      if (!live) return
      setLoaded({
        status: 'error', count: 0, demo: false,
        error: error instanceof Error ? error.message : 'Không thể tải danh sách từ.',
      })
    })
    return () => { live = false }
  }, [section, requested])

  if (!requested) return { status: 'idle', count: 0, demo: false }
  return loaded ?? { status: 'loading', count: 0, demo: false }
}

export function useKanjiReadings(enabled: boolean): Record<string, string[]> {
  const [kanji, setKanji] = useState<Record<string, string[]>>({})
  useEffect(() => {
    if (!enabled) return
    let live = true
    loadKanjiReadings().then((readings) => {
      if (live) setKanji(readings)
    }, (error) => console.warn('Hán Việt readings unavailable:', error))
    return () => { live = false }
  }, [enabled])
  return kanji
}

/**
 * Prefix suggestions, or with `similar` the closest spellings, from the worker;
 * keeps the previous list while a new query is pending.
 */
export function useSuggestions(section: Section, input: string, ready: boolean, limit = 8, similar = false) {
  const [answered, setAnswered] = useState<{ section: Section; key: string; words: string[] } | null>(null)
  const key = ready && input.trim() ? input + '\n' + limit : ''

  useEffect(() => {
    if (!key) return
    let live = true
    const search = similar ? similarWords : suggestWords
    search(section, input, limit).then((words) => {
      if (live) setAnswered({ section, key, words })
    }, () => {
      if (live) setAnswered({ section, key, words: [] })
    })
    return () => { live = false }
  }, [section, input, key, limit, similar])

  if (!key) return { words: [], pending: false }
  const current = answered?.section === section
  return { words: current ? answered.words : [], pending: !current || answered.key !== key }
}

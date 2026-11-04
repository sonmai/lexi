import { useEffect, useState } from 'react'
import type { DictionaryEntry } from '../data/types'
import { lookupJapanese, lookupWord, type JapaneseLookup } from '../dictionary-service'
import { rememberLookup } from './useRecentLookups'
import type { Route } from './useRoute'

export type LookupResult = { mode: 'en'; entry: DictionaryEntry } | { mode: 'ja'; lookup: JapaneseLookup }

export function useLookup({ word, mode }: Route) {
  const [answered, setAnswered] = useState<{ key: string; result: LookupResult | null; error: string } | null>(null)
  const key = word ? mode + '\n' + word : ''

  useEffect(() => {
    if (!key) return
    let live = true
    const lookup: Promise<LookupResult | null> = mode === 'ja'
      ? lookupJapanese(word).then((found): LookupResult | null => found && { mode: 'ja', lookup: found })
      : lookupWord(word).then((found): LookupResult | null => found && { mode: 'en', entry: found })
    lookup.then((result) => {
      if (!live) return
      if (result) rememberLookup(mode, result.mode === 'en' ? result.entry.headword : result.lookup.headword)
      setAnswered({ key, result, error: '' })
    }, (failure) => {
      if (live) setAnswered({ key, result: null, error: failure instanceof Error ? failure.message : 'Không thể tải định nghĩa.' })
    })
    return () => { live = false }
  }, [key, word, mode])

  if (!key || answered?.key !== key) return { result: null, loading: Boolean(key), error: '' }
  return { result: answered.result, loading: false, error: answered.error }
}

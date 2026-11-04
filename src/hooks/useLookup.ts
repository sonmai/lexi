import { useEffect, useState } from 'react'
import type { DictionaryEntry } from '../data/types'
import { lookupJapanese, lookupWord, type JapaneseLookup } from '../dictionary-service'
import type { Route } from './useRoute'

export type LookupResult = { mode: 'en'; entry: DictionaryEntry } | { mode: 'ja'; lookup: JapaneseLookup }

export function useLookup({ word, mode }: Route) {
  const [result, setResult] = useState<LookupResult | null>(null)
  const [loading, setLoading] = useState(Boolean(word))
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    setError('')
    if (!word) {
      setResult(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const lookup: Promise<LookupResult | null> = mode === 'ja'
      ? lookupJapanese(word).then((found): LookupResult | null => found && { mode: 'ja', lookup: found })
      : lookupWord(word).then((found): LookupResult | null => found && { mode: 'en', entry: found })
    lookup.then((found) => {
      if (live) setResult(found)
    }, (failure) => {
      if (!live) return
      setResult(null)
      setError(failure instanceof Error ? failure.message : 'Không thể tải định nghĩa.')
    }).finally(() => {
      if (live) setLoading(false)
    })
    return () => { live = false }
  }, [word, mode])

  return { result, loading, error }
}

import { useEffect, useState } from 'react'
import { loadKanjiReadings, onActiveDataChange, type Section } from '../dictionary-service'
import { loadIndex, suggestWords } from '../suggest-client'

export interface IndexState {
  status: 'idle' | 'loading' | 'ready' | 'missing' | 'error'
  count: number
  demo: boolean
  error?: string
}

/** Increments when lookups for `section` switch to another data version. */
function useDataRevision(section: Section): number {
  const [revision, setRevision] = useState(0)
  useEffect(() => onActiveDataChange((changed) => {
    if (changed === section) setRevision((value) => value + 1)
  }), [section])
  return revision
}

/** Loads a section's suggestion index the first time `enabled` is true, and again after a data update. */
export function useDictionaryIndex(section: Section, enabled: boolean): IndexState {
  const [state, setState] = useState<IndexState>({ status: 'idle', count: 0, demo: false })
  const [requested, setRequested] = useState(enabled)
  if (enabled && !requested) setRequested(true)
  const revision = useDataRevision(section)

  useEffect(() => {
    if (!requested) return
    let live = true
    setState((previous) => previous.status === 'ready' ? previous : { ...previous, status: 'loading' })
    loadIndex(section).then((info) => {
      if (live) setState(info ? { status: 'ready', ...info } : { status: 'missing', count: 0, demo: false })
    }, (error) => {
      if (!live) return
      setState({
        status: 'error', count: 0, demo: false,
        error: error instanceof Error ? error.message : 'Không thể tải danh sách từ.',
      })
    })
    return () => { live = false }
  }, [section, requested, revision])

  return state
}

export function useKanjiReadings(enabled: boolean): Record<string, string[]> {
  const [kanji, setKanji] = useState<Record<string, string[]>>({})
  const revision = useDataRevision('ja')
  useEffect(() => {
    if (!enabled) return
    let live = true
    loadKanjiReadings().then((readings) => {
      if (live) setKanji(readings)
    }, (error) => console.warn('Hán Việt readings unavailable:', error))
    return () => { live = false }
  }, [enabled, revision])
  return kanji
}

/** Prefix suggestions from the worker; keeps the previous list while a new query is pending. */
export function useSuggestions(section: Section, input: string, ready: boolean, limit = 8) {
  const [state, setState] = useState<{ section: Section; key: string; words: string[] }>({ section, key: '', words: [] })
  const key = input.trim() ? input + '\n' + limit : ''

  useEffect(() => {
    if (!ready || !key) {
      setState({ section, key, words: [] })
      return
    }
    let live = true
    suggestWords(section, input, limit).then((words) => {
      if (live) setState({ section, key, words })
    }, () => {
      if (live) setState({ section, key, words: [] })
    })
    return () => { live = false }
  }, [section, input, key, ready, limit])

  const current = state.section === section
  return { words: current ? state.words : [], pending: !current || state.key !== key }
}

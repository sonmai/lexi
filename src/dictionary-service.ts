import { dictionary as demoEntries, byHeadword, normalise } from './data/dictionary'
import type { DictionaryEntry, JapaneseEntry } from './data/types'
import {
  japaneseLookupKeys, japaneseSearchKeys, japaneseShard, normalizeJapanese,
} from './utils/japanese'

export interface JapaneseManifest {
  version: string
  count: number
  index: string
  kanji: string
  chunks: string[]
  chunkStrategy: 'fnv1a'
  shardCount: number
}

export interface DictionaryManifest {
  version: string
  count: number
  /** Null when only the Japanese section has been built locally. */
  index: string | null
  chunks: string[]
  chunkStrategy?: 'prefix2' | 'first-letter'
  japanese?: JapaneseManifest
}

export interface JapaneseLookup {
  headword: string
  entries: JapaneseEntry[]
}

const offlineCacheName = 'lexi-dictionary-v2'
let manifestPromise: Promise<DictionaryManifest | null> | null = null
let wordsPromise: Promise<string[]> | null = null
let japaneseWordsPromise: Promise<string[]> | null = null
let kanjiPromise: Promise<Record<string, string[]>> | null = null
const shards = new Map<string, Promise<Record<string, unknown>>>()

function loadShard<T>(cacheKey: string, url: string): Promise<Record<string, T>> {
  if (!shards.has(cacheKey)) {
    shards.set(cacheKey, requestJson<Record<string, T>>(url).catch((error) => {
      shards.delete(cacheKey)
      throw error
    }))
  }
  return shards.get(cacheKey)! as Promise<Record<string, T>>
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not fetch ' + url + ': HTTP ' + response.status)
  if (!(response.headers.get('content-type') || '').includes('json')) {
    throw new Error('Expected JSON from ' + url)
  }
  return response.json() as Promise<T>
}

export function getManifest(): Promise<DictionaryManifest | null> {
  if (!manifestPromise) {
    manifestPromise = requestJson<DictionaryManifest>('/dictionary/manifest.json')
      .then((value) => {
        if (!value || !value.version || !Array.isArray(value.chunks)) {
          throw new Error('Invalid dictionary manifest')
        }
        return value
      })
      .catch((error) => {
        console.warn('Using the bundled demo dictionary:', error)
        return null
      })
  }
  return manifestPromise
}

export async function loadWords(): Promise<string[]> {
  if (!wordsPromise) {
    wordsPromise = (async () => {
      const manifest = await getManifest()
      if (!manifest?.index) return demoEntries.map((entry) => entry.headword)
      const result = await requestJson<string[]>(manifest.index)
      if (!Array.isArray(result) || !result.length) throw new Error('Dictionary index is empty')
      return result
    })().catch((error) => {
      wordsPromise = null
      throw error
    })
  }
  return wordsPromise
}

export function suggest(words: string[], input: string, limit = 8): string[] {
  const prefix = normalise(input)
  if (!prefix) return []
  let lo = 0
  let hi = words.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (words[mid] < prefix) lo = mid + 1
    else hi = mid
  }
  const result: string[] = []
  while (lo < words.length && result.length < limit && words[lo].startsWith(prefix)) {
    result.push(words[lo++])
  }
  return result
}

export async function lookupWord(word: string): Promise<DictionaryEntry | null> {
  const key = normalise(word)
  if (!key) return null
  const manifest = await getManifest()
  if (!manifest?.index) return byHeadword.get(key) ?? null
  const first = /^[a-z]/.test(key) ? key[0] : 'other'
  const chunk = manifest.chunkStrategy === 'prefix2'
    ? (first === 'other' ? first : /^[a-z]/.test(key[1] || '') ? key.slice(0, 2) : first + '_')
    : first
  const url = '/dictionary/data/' + manifest.version + '/' + chunk + '.json'
  if (!manifest.chunks.includes(url)) return null
  return (await loadShard<DictionaryEntry>(manifest.version + ':' + chunk, url))[key] ?? null
}

/** Display forms sorted by their normalised key in UTF-16 order; empty when not built. */
export async function loadJapaneseWords(): Promise<string[]> {
  if (!japaneseWordsPromise) {
    japaneseWordsPromise = (async () => {
      const japanese = (await getManifest())?.japanese
      return japanese ? requestJson<string[]>(japanese.index) : []
    })().catch((error) => {
      japaneseWordsPromise = null
      throw error
    })
  }
  return japaneseWordsPromise
}

export function loadKanjiReadings(): Promise<Record<string, string[]>> {
  if (!kanjiPromise) {
    kanjiPromise = (async () => {
      const japanese = (await getManifest())?.japanese
      return japanese ? requestJson<Record<string, string[]>>(japanese.kanji) : {}
    })().catch((error) => {
      kanjiPromise = null
      throw error
    })
  }
  return kanjiPromise
}

export function suggestJapanese(words: string[], input: string, limit = 8): string[] {
  const result: string[] = []
  for (const prefix of japaneseSearchKeys(input)) {
    let lo = 0
    let hi = words.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (normalizeJapanese(words[mid]) < prefix) lo = mid + 1
      else hi = mid
    }
    while (lo < words.length && result.length < limit && normalizeJapanese(words[lo]).startsWith(prefix)) {
      if (!result.includes(words[lo])) result.push(words[lo])
      lo += 1
    }
    if (result.length >= limit) break
  }
  return result
}

export async function lookupJapanese(word: string): Promise<JapaneseLookup | null> {
  const japanese = (await getManifest())?.japanese
  if (!japanese) return null
  for (const key of japaneseLookupKeys(word)) {
    const chunk = japaneseShard(key, japanese.shardCount)
    const url = '/dictionary/data/ja-' + japanese.version + '/' + chunk + '.json'
    if (!japanese.chunks.includes(url)) continue
    const entries = (await loadShard<JapaneseEntry[]>('ja-' + japanese.version + ':' + chunk, url))[key]
    if (entries?.length) return { headword: word.trim(), entries }
  }
  return null
}

function offlineUrls(manifest: DictionaryManifest): string[] {
  const urls = manifest.index ? [manifest.index, ...manifest.chunks] : []
  if (manifest.japanese) urls.push(manifest.japanese.index, manifest.japanese.kanji, ...manifest.japanese.chunks)
  return urls
}

export async function offlineProgress(): Promise<{ saved: number; total: number }> {
  const manifest = await getManifest()
  if (!manifest || !('caches' in window)) return { saved: 0, total: 0 }
  const cache = await caches.open(offlineCacheName)
  const urls = offlineUrls(manifest)
  const responses = await Promise.all(urls.map((url) => cache.match(url)))
  return { saved: responses.filter(Boolean).length, total: urls.length }
}

export async function downloadForOffline(
  onProgress: (saved: number, total: number) => void
): Promise<void> {
  const manifest = await getManifest()
  if (!manifest) throw new Error('Full dictionary has not been imported yet.')
  if (!('caches' in window)) throw new Error('Offline storage is not available in this browser.')
  const cache = await caches.open(offlineCacheName)
  const urls = offlineUrls(manifest)
  let saved = 0
  for (let i = 0; i < urls.length; i += 3) {
    await Promise.all(urls.slice(i, i + 3).map(async (url) => {
      if (!(await cache.match(url))) {
        const response = await fetch(url)
        if (!response.ok || !(response.headers.get('content-type') || '').includes('json')) {
          throw new Error('Unable to download ' + url)
        }
        await cache.put(url, response.clone())
      }
      saved += 1
      onProgress(saved, urls.length)
    }))
  }
}

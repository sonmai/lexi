import { dictionary as demoEntries, byHeadword, normalise } from './data/dictionary'
import type { DictionaryEntry } from './data/types'

export interface DictionaryManifest {
  version: string
  count: number
  index: string
  chunks: string[]
  chunkStrategy?: 'prefix2' | 'first-letter'
}

const offlineCacheName = 'lexi-dictionary-v2'
let manifestPromise: Promise<DictionaryManifest | null> | null = null
let wordsPromise: Promise<string[]> | null = null
const shards = new Map<string, Promise<Record<string, DictionaryEntry>>>()

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
      if (!manifest) return demoEntries.map((entry) => entry.headword)
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
  if (!manifest) return byHeadword.get(key) ?? null
  const first = /^[a-z]/.test(key) ? key[0] : 'other'
  const chunk = manifest.chunkStrategy === 'prefix2'
    ? (first === 'other' ? first : /^[a-z]/.test(key[1] || '') ? key.slice(0, 2) : first + '_')
    : first
  const url = '/dictionary/data/' + manifest.version + '/' + chunk + '.json'
  if (!manifest.chunks.includes(url)) return null
  const cacheKey = manifest.version + ':' + chunk
  if (!shards.has(cacheKey)) {
    shards.set(cacheKey, requestJson<Record<string, DictionaryEntry>>(url).catch((error) => {
      shards.delete(cacheKey)
      throw error
    }))
  }
  return (await shards.get(cacheKey)!)[key] ?? null
}

export async function offlineProgress(): Promise<{ saved: number; total: number }> {
  const manifest = await getManifest()
  if (!manifest || !('caches' in window)) return { saved: 0, total: 0 }
  const cache = await caches.open(offlineCacheName)
  const urls = [manifest.index, ...manifest.chunks]
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
  const urls = [manifest.index, ...manifest.chunks]
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

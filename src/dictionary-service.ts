import type { DictionaryEntry, JapaneseEntry } from './data/types'
import { englishChunk, normaliseEnglish, type EnglishChunkStrategy } from './utils/english'
import { japaneseLookupKeys, japaneseShard } from './utils/japanese'

export type Section = 'en' | 'ja'

export interface EnglishSection {
  version: string
  count: number
  index: string
  chunks: string[]
  chunkStrategy?: EnglishChunkStrategy
}

export interface JapaneseSection {
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
  chunkStrategy?: EnglishChunkStrategy
  japanese?: JapaneseSection
}

interface Sections {
  en?: EnglishSection
  ja?: JapaneseSection
}

type SectionManifest<S extends Section> = NonNullable<Sections[S]>

export interface JapaneseLookup {
  headword: string
  entries: JapaneseEntry[]
}

/** Left behind by the removed offline download. Deleted on startup so it cannot shadow the deployed data. */
const RETIRED_PIN = 'lexi-offline-v1'
const RETIRED_CACHES = ['lexi-dictionary-v2', 'lexi-manifest-v1']

let manifestPromise: Promise<DictionaryManifest | null> | null = null
const shards = new Map<string, Promise<Record<string, unknown>>>()

function isJson(response: Response): boolean {
  return (response.headers.get('content-type') || '').includes('json')
}

/** Drops a previously downloaded offline copy. Lookups never read it. */
export function forgetOfflineDictionary(): void {
  try {
    localStorage.removeItem(RETIRED_PIN)
  } catch {
    // Private mode can block storage. Lookups do not read it.
  }
  if (!('caches' in window)) return
  void Promise.all(RETIRED_CACHES.map((name) => caches.delete(name))).catch(() => undefined)
}

async function fetchData(url: string): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new Error('Không có kết nối mạng.')
  }
  if (!response.ok) throw new Error('Could not fetch ' + url + ': HTTP ' + response.status)
  if (!isJson(response)) throw new Error('Expected JSON from ' + url)
  return response
}

async function requestJson<T>(url: string): Promise<T> {
  return (await fetchData(url)).json() as Promise<T>
}

function loadShard<T>(url: string): Promise<Record<string, T>> {
  if (!shards.has(url)) {
    shards.set(url, requestJson<Record<string, unknown>>(url).catch((error) => {
      shards.delete(url)
      throw error
    }))
  }
  return shards.get(url)! as Promise<Record<string, T>>
}

/**
 * Resolves to null when this build has no generated data, so the demo entries apply.
 * Rejects when the manifest cannot be reached.
 */
export function getManifest(): Promise<DictionaryManifest | null> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      let response: Response
      try {
        response = await fetch('/dictionary/manifest.json')
      } catch {
        throw new Error('Không có kết nối mạng.')
      }
      if (response.status === 404 || (response.ok && !isJson(response))) return null
      if (!response.ok) throw new Error('Could not fetch the dictionary manifest: HTTP ' + response.status)
      const value = await response.json() as DictionaryManifest
      if (!value || !value.version || !Array.isArray(value.chunks)) throw new Error('Invalid dictionary manifest')
      return value
    })().catch((error) => {
      manifestPromise = null
      throw error
    })
  }
  return manifestPromise
}

async function latestSections(): Promise<Sections> {
  const manifest = await getManifest()
  if (!manifest) return {}
  const { japanese, index, version, count, chunks, chunkStrategy } = manifest
  return { en: index ? { version, count, index, chunks, chunkStrategy } : undefined, ja: japanese }
}

async function sectionOf<S extends Section>(section: S): Promise<SectionManifest<S> | null> {
  return ((await latestSections())[section] ?? null) as SectionManifest<S> | null
}

export interface IndexData {
  buffer: ArrayBuffer
  count: number
  demo: boolean
}

/** The suggestion index as raw JSON, for parsing off the main thread; null when the section has no data. */
export function readIndex(section: Section): Promise<IndexData | null> {
  return sectionOf(section).then(async (manifest) => {
    if (manifest) {
      return { buffer: await (await fetchData(manifest.index)).arrayBuffer(), count: manifest.count, demo: false }
    }
    if (section === 'ja') return null
    const { demoWords } = await import('./data/dictionary')
    const buffer = new TextEncoder().encode(JSON.stringify(demoWords)).buffer as ArrayBuffer
    return { buffer, count: demoWords.length, demo: true }
  })
}

export async function lookupWord(word: string): Promise<DictionaryEntry | null> {
  const key = normaliseEnglish(word)
  if (!key) return null
  const manifest = await sectionOf('en')
  if (!manifest) return (await import('./data/dictionary')).demoByHeadword.get(key) ?? null
  const url = '/dictionary/data/' + manifest.version + '/' + englishChunk(key, manifest.chunkStrategy) + '.json'
  if (!manifest.chunks.includes(url)) return null
  return (await loadShard<DictionaryEntry>(url))[key] ?? null
}

export function loadKanjiReadings(): Promise<Record<string, string[]>> {
  return sectionOf('ja').then((manifest) => manifest ? requestJson<Record<string, string[]>>(manifest.kanji) : {})
}

export async function lookupJapanese(word: string): Promise<JapaneseLookup | null> {
  const manifest = await sectionOf('ja')
  if (!manifest) return null
  for (const key of japaneseLookupKeys(word)) {
    const url = '/dictionary/data/ja-' + manifest.version + '/' + japaneseShard(key, manifest.shardCount) + '.json'
    if (!manifest.chunks.includes(url)) continue
    const entries = (await loadShard<JapaneseEntry[]>(url))[key]
    if (entries?.length) return { headword: word.trim(), entries }
  }
  return null
}

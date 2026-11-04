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
  /** Total size of the index and chunks; absent in data built before sizes were recorded. */
  bytes?: number
}

export interface JapaneseSection {
  version: string
  count: number
  index: string
  kanji: string
  chunks: string[]
  chunkStrategy: 'fnv1a'
  shardCount: number
  bytes?: number
}

export interface DictionaryManifest {
  version: string
  count: number
  /** Null when only the Japanese section has been built locally. */
  index: string | null
  chunks: string[]
  chunkStrategy?: EnglishChunkStrategy
  bytes?: number
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

/** Shared with the service worker's runtime caching in vite.config.ts. */
const DICTIONARY_CACHE = 'lexi-dictionary-v2'
/**
 * Sections whose every file is in DICTIONARY_CACHE. Lookups keep using a pinned
 * version after a newer one is deployed, until the user downloads the update.
 */
const PINNED_KEY = 'lexi-offline-v1'
const DOWNLOAD_CONCURRENCY = 4

let manifestPromise: Promise<DictionaryManifest | null> | null = null
const shards = new Map<string, Promise<Record<string, unknown>>>()
const listeners = new Set<(section: Section) => void>()

function isJson(response: Response): boolean {
  return (response.headers.get('content-type') || '').includes('json')
}

/** Reads dictionary files from the offline cache first, so pinned data works without the service worker. */
async function fetchData(url: string): Promise<Response> {
  if ('caches' in window) {
    const cached = await (await caches.open(DICTIONARY_CACHE)).match(url)
    if (cached) return cached
  }
  const response = await fetch(url)
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
 * Rejects when the manifest cannot be reached, e.g. offline before it was ever cached.
 */
export function getManifest(): Promise<DictionaryManifest | null> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      const response = await fetch('/dictionary/manifest.json').catch(() => {
        throw new Error('Không có kết nối mạng và từ điển chưa được tải về để dùng offline.')
      })
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
  const { japanese, index, version, count, chunks, chunkStrategy, bytes } = manifest
  return { en: index ? { version, count, index, chunks, chunkStrategy, bytes } : undefined, ja: japanese }
}

function readPinned(): Sections {
  try {
    return JSON.parse(localStorage.getItem(PINNED_KEY) || '{}') as Sections
  } catch {
    return {}
  }
}

function setPinned<S extends Section>(section: S, manifest: SectionManifest<S> | undefined) {
  const pinned = readPinned()
  const previous = pinned[section]?.version
  if (manifest) pinned[section] = manifest
  else delete pinned[section]
  localStorage.setItem(PINNED_KEY, JSON.stringify(pinned))
  // A first pin is the deployed version already in use; only replacing or dropping one changes the data.
  if (previous && previous !== manifest?.version) listeners.forEach((listener) => listener(section))
}

/** Called when lookups switch to another data version for a section. */
export function onActiveDataChange(listener: (section: Section) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

async function activeSection<S extends Section>(section: S): Promise<SectionManifest<S> | null> {
  const pinned = readPinned()[section]
  if (pinned) return pinned as SectionManifest<S>
  return ((await latestSections())[section] ?? null) as SectionManifest<S> | null
}

/** Runs against the active data; if a pinned copy turns out to be evicted, unpins it and retries once. */
async function withActive<S extends Section, T>(
  section: S, run: (manifest: SectionManifest<S> | null) => Promise<T>,
): Promise<T> {
  const pinned = readPinned()[section]?.version
  const manifest = await activeSection(section)
  try {
    return await run(manifest)
  } catch (error) {
    if (!pinned) throw error
    // offlineStatus may have unpinned the same evicted copy meanwhile.
    if (readPinned()[section]?.version === pinned) setPinned(section, undefined)
    return run(await activeSection(section))
  }
}

export interface IndexData {
  buffer: ArrayBuffer
  count: number
  demo: boolean
}

/** The suggestion index as raw JSON, for parsing off the main thread; null when the section has no data. */
export function readIndex(section: Section): Promise<IndexData | null> {
  return withActive(section, async (manifest) => {
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
  return withActive('en', async (manifest) => {
    if (!manifest) return (await import('./data/dictionary')).demoByHeadword.get(key) ?? null
    const url = '/dictionary/data/' + manifest.version + '/' + englishChunk(key, manifest.chunkStrategy) + '.json'
    if (!manifest.chunks.includes(url)) return null
    return (await loadShard<DictionaryEntry>(url))[key] ?? null
  })
}

export function loadKanjiReadings(): Promise<Record<string, string[]>> {
  return withActive('ja', async (manifest) => manifest ? requestJson<Record<string, string[]>>(manifest.kanji) : {})
}

export async function lookupJapanese(word: string): Promise<JapaneseLookup | null> {
  return withActive('ja', async (manifest) => {
    if (!manifest) return null
    for (const key of japaneseLookupKeys(word)) {
      const url = '/dictionary/data/ja-' + manifest.version + '/' + japaneseShard(key, manifest.shardCount) + '.json'
      if (!manifest.chunks.includes(url)) continue
      const entries = (await loadShard<JapaneseEntry[]>(url))[key]
      if (entries?.length) return { headword: word.trim(), entries }
    }
    return null
  })
}

function sectionUrls(manifest: EnglishSection | JapaneseSection): string[] {
  const urls = [manifest.index, ...manifest.chunks]
  return 'kanji' in manifest ? [...urls, manifest.kanji] : urls
}

async function countCached(cache: Cache, urls: string[]): Promise<number> {
  return (await Promise.all(urls.map((url) => cache.match(url)))).filter(Boolean).length
}

export interface OfflineStatus {
  /** `update`: a complete older copy is in use and a newer version is deployed. */
  state: 'unavailable' | 'none' | 'partial' | 'ready' | 'update'
  /** Progress towards the version a download would fetch. */
  saved: number
  total: number
  bytes?: number
}

export async function offlineStatus(section: Section): Promise<OfflineStatus> {
  const unavailable: OfflineStatus = { state: 'unavailable', saved: 0, total: 0 }
  if (!('caches' in window)) return unavailable
  const cache = await caches.open(DICTIONARY_CACHE)
  const latest = await latestSections().then((sections) => sections[section], () => undefined)
  const pinned = readPinned()[section]
  if (pinned) {
    const urls = sectionUrls(pinned)
    const saved = await countCached(cache, urls)
    if (saved === urls.length) {
      if (!latest || latest.version === pinned.version) {
        return { state: 'ready', saved, total: urls.length, bytes: pinned.bytes }
      }
      const pending = sectionUrls(latest)
      return { state: 'update', saved: await countCached(cache, pending), total: pending.length, bytes: latest.bytes }
    }
    setPinned(section, undefined)
  }
  if (!latest) return unavailable
  const urls = sectionUrls(latest)
  const saved = await countCached(cache, urls)
  if (saved === urls.length) setPinned(section, latest)
  return {
    state: saved === urls.length ? 'ready' : saved ? 'partial' : 'none',
    saved, total: urls.length, bytes: latest.bytes,
  }
}

export interface DownloadResult {
  /** False when the browser may still evict the data under storage pressure. */
  persisted: boolean
}

export async function downloadSection(
  section: Section, onProgress: (saved: number, total: number) => void,
): Promise<DownloadResult> {
  if (!('caches' in window)) throw new Error('Trình duyệt này không hỗ trợ lưu dữ liệu offline.')
  const latest = (await latestSections())[section]
  if (!latest) throw new Error('Bản này chưa có dữ liệu để tải offline.')
  const cache = await caches.open(DICTIONARY_CACHE)
  const urls = sectionUrls(latest)

  const missingShare = 1 - (await countCached(cache, urls)) / urls.length
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined)
  const needed = (latest.bytes ?? 0) * missingShare
  if (estimate?.quota && needed > estimate.quota - (estimate.usage ?? 0)) {
    throw new Error('Không đủ dung lượng: cần khoảng ' + Math.ceil(needed / 1e6) + ' MB trống.')
  }
  const persisted = await navigator.storage?.persist?.().catch(() => false) ?? false

  let saved = 0
  let next = 0
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++]
      if (!(await cache.match(url))) {
        const response = await fetch(url)
        if (!response.ok || !isJson(response)) throw new Error('Không tải được ' + url)
        await cache.put(url, response)
      }
      saved += 1
      onProgress(saved, urls.length)
    }
  }
  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker))
  setPinned(section, latest)
  await pruneOfflineCache()
  return { persisted }
}

/** Deletes cached dictionary files that belong to neither a pinned nor the deployed version. */
export async function pruneOfflineCache(): Promise<number> {
  if (!('caches' in window)) return 0
  const latest = await latestSections().catch(() => null)
  // Offline, the deployed version is unknown, so nothing can safely be called stale.
  if (!latest) return 0
  const pinned = readPinned()
  const keep = new Set([pinned.en, pinned.ja, latest.en, latest.ja].flatMap((manifest) => manifest ? sectionUrls(manifest) : []))
  const cache = await caches.open(DICTIONARY_CACHE)
  const stale = (await cache.keys()).filter((request) => !keep.has(new URL(request.url).pathname))
  await Promise.all(stale.map((request) => cache.delete(request)))
  return stale.length
}

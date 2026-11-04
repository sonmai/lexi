import { onActiveDataChange, readIndex, type Section } from './dictionary-service'
import type { SuggestRequest, SuggestResponse } from './suggest.worker'

export interface IndexInfo {
  count: number
  demo: boolean
}

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, { resolve: (response: SuggestResponse) => void; reject: (error: Error) => void }>()
const indexes = new Map<Section, Promise<IndexInfo | null>>()

function createWorker(): Worker {
  const instance = new Worker(new URL('./suggest.worker.ts', import.meta.url), { type: 'module' })
  instance.onmessage = (event: MessageEvent<SuggestResponse>) => {
    const request = pending.get(event.data.id)
    if (!request) return
    pending.delete(event.data.id)
    if (event.data.error) request.reject(new Error(event.data.error))
    else request.resolve(event.data)
  }
  instance.onerror = (event) => {
    for (const request of pending.values()) request.reject(new Error(event.message || 'Suggestion worker failed'))
    pending.clear()
    indexes.clear()
    worker = null
  }
  return instance
}

function send(request: SuggestRequest, transfer: Transferable[] = []): Promise<SuggestResponse> {
  worker ??= createWorker()
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    worker!.postMessage({ ...request, id }, transfer)
  })
}

/** Loads a section's index into the worker once per data version; null when the section has no data. */
export function loadIndex(section: Section): Promise<IndexInfo | null> {
  let loading = indexes.get(section)
  if (!loading) {
    const current: Promise<IndexInfo | null> = (async () => {
      const data = await readIndex(section)
      if (!data) return null
      await send({ type: 'load', section, buffer: data.buffer }, [data.buffer])
      return { count: data.count, demo: data.demo }
    })()
    current.catch(() => {
      if (indexes.get(section) === current) indexes.delete(section)
    })
    indexes.set(section, current)
    loading = current
  }
  return loading
}

export async function suggestWords(section: Section, input: string, limit = 8): Promise<string[]> {
  if (!input.trim() || !(await loadIndex(section))) return []
  return (await send({ type: 'suggest', section, input, limit })).words ?? []
}

/** Closest known words to one that was not found. */
export async function similarWords(section: Section, input: string, limit = 6): Promise<string[]> {
  if (!input.trim() || !(await loadIndex(section))) return []
  return (await send({ type: 'similar', section, input, limit })).words ?? []
}

onActiveDataChange((section) => indexes.delete(section))

import type { Section } from './dictionary-service'
import { similarEnglish, similarJapanese, suggestEnglish, suggestJapanese } from './utils/prefixSearch'

/** Parses the multi-megabyte suggestion indexes and answers prefix queries off the main thread. */

export type SuggestRequest =
  | { type: 'load'; section: Section; buffer: ArrayBuffer }
  | { type: 'suggest' | 'similar'; section: Section; input: string; limit: number }

export type SuggestResponse = { id: number; words?: string[]; error?: string }

const indexes = new Map<Section, string[]>()

self.onmessage = (event: MessageEvent<SuggestRequest & { id: number }>) => {
  const request = event.data
  const reply = (response: Omit<SuggestResponse, 'id'>) => self.postMessage({ id: request.id, ...response })
  try {
    if (request.type === 'load') {
      const words: unknown = JSON.parse(new TextDecoder().decode(request.buffer))
      if (!Array.isArray(words) || (request.section === 'en' && !words.length)) {
        throw new Error('Dictionary index is empty')
      }
      indexes.set(request.section, words)
      reply({})
    } else {
      const words = indexes.get(request.section) ?? []
      const search = request.type === 'similar'
        ? request.section === 'ja' ? similarJapanese : similarEnglish
        : request.section === 'ja' ? suggestJapanese : suggestEnglish
      reply({ words: search(words, request.input, request.limit) })
    }
  } catch (error) {
    reply({ error: error instanceof Error ? error.message : String(error) })
  }
}

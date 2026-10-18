import entries from './entries.json'
import type { DictionaryEntry } from './types'

export type { DictionaryEntry, Sense } from './types'

// The checked-in dataset is intentionally small and original: a UI prototype,
// NOT an imported/licensed production dictionary.
export const dictionary = (entries as DictionaryEntry[]).sort((a, b) =>
  a.headword.localeCompare(b.headword, 'en')
)

export const byHeadword = new Map(
  dictionary.map((entry) => [entry.headword.toLowerCase(), entry])
)

export function normalise(input: string): string {
  return input.toLowerCase().normalize('NFKC').trim().replace(/\s+/g, ' ')
}

export function searchHeadwords(query: string, limit = 7): DictionaryEntry[] {
  const term = normalise(query)
  if (!term) return []
  const startsWith = dictionary.filter((entry) =>
    normalise(entry.headword).startsWith(term)
  )
  const contains = dictionary.filter(
    (entry) =>
      !normalise(entry.headword).startsWith(term) &&
      normalise(entry.headword).includes(term)
  )
  return [...startsWith, ...contains].slice(0, limit)
}

/**
 * English lookup keys. `normaliseEnglish` and `englishChunk` must stay in sync with
 * `normalize` and `shard_key` in scripts/build_dictionary.py.
 */

export type EnglishChunkStrategy = 'prefix2' | 'first-letter'

export function normaliseEnglish(input: string): string {
  return input.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ')
}

export function englishChunk(key: string, strategy: EnglishChunkStrategy = 'first-letter'): string {
  const first = /^[a-z]/.test(key) ? key[0] : 'other'
  if (strategy !== 'prefix2' || first === 'other') return first
  return /^[a-z]/.test(key[1] || '') ? key.slice(0, 2) : first + '_'
}

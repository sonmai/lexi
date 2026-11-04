import { normaliseEnglish } from './english.ts'
import { japaneseSearchKeys, normalizeJapanese } from './japanese.ts'

/** Index of the first word whose key is not below `prefix`; `words` is sorted by that key in UTF-16 order. */
function lowerBound(words: string[], prefix: string, key: (word: string) => string): number {
  let lo = 0
  let hi = words.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (key(words[mid]) < prefix) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function suggestEnglish(words: string[], input: string, limit = 8): string[] {
  const prefix = normaliseEnglish(input)
  if (!prefix) return []
  const result: string[] = []
  for (let i = lowerBound(words, prefix, (word) => word); i < words.length && result.length < limit; i += 1) {
    if (!words[i].startsWith(prefix)) break
    result.push(words[i])
  }
  return result
}

/** Display forms sorted by their normalised key; romaji input also searches its kana conversion. */
export function suggestJapanese(words: string[], input: string, limit = 8): string[] {
  const result: string[] = []
  for (const prefix of japaneseSearchKeys(input)) {
    for (let i = lowerBound(words, prefix, normalizeJapanese); i < words.length && result.length < limit; i += 1) {
      if (!normalizeJapanese(words[i]).startsWith(prefix)) break
      if (!result.includes(words[i])) result.push(words[i])
    }
    if (result.length >= limit) break
  }
  return result
}

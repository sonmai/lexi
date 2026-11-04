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

/** Optimal string alignment distance, or `max + 1` once it is certain to exceed `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let beforePrevious: number[] = []
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, beforePrevious[j - 2] + 1)
      }
      current.push(value)
      rowMin = Math.min(rowMin, value)
    }
    if (rowMin > max) return max + 1
    beforePrevious = previous
    previous = current
  }
  return previous[b.length]
}

/** Closest spellings to a word that is not in the list, among words sharing its first letter. */
export function similarEnglish(words: string[], input: string, limit = 6): string[] {
  const key = normaliseEnglish(input)
  if (key.length < 2) return []
  const max = key.length <= 4 ? 1 : key.length <= 8 ? 2 : 3
  const scored: { word: string; score: number }[] = []
  for (let i = lowerBound(words, key[0], (word) => word); i < words.length && words[i].startsWith(key[0]); i += 1) {
    const distance = editDistance(key, words[i], max)
    if (distance > 0 && distance <= max) {
      scored.push({ word: words[i], score: distance * 100 + Math.abs(words[i].length - key.length) })
    }
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map(({ word }) => word)
}

/** Japanese has no spelling to correct, so this offers words sharing the longest known prefix. */
export function similarJapanese(words: string[], input: string, limit = 6): string[] {
  const chars = [...input.trim()]
  for (let length = chars.length - 1; length >= 1; length -= 1) {
    const found = suggestJapanese(words, chars.slice(0, length).join(''), limit)
    if (found.length) return found
  }
  return []
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

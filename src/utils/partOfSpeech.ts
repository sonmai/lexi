import type { Sense } from '../data/types'

/**
 * Normalise mixed part-of-speech labels from Skypedia, Wiktionary and WordNet.
 * Keep the original label on each sense; grouping changes presentation only.
 */
export type PartOfSpeechKey =
  | 'noun' | 'properNoun' | 'verb' | 'phrasalVerb' | 'adjective' | 'adverb'
  | 'pronoun' | 'determiner' | 'preposition' | 'conjunction' | 'interjection'
  | 'numeral' | 'idiom' | 'phrase' | 'prefix' | 'suffix' | 'abbreviation'
  | 'symbol' | 'other'

export interface SenseGroup {
  key: PartOfSpeechKey
  label: string
  senses: Sense[]
}

const groupOrder: PartOfSpeechKey[] = [
  'noun', 'properNoun', 'verb', 'phrasalVerb', 'adjective', 'adverb',
  'pronoun', 'determiner', 'preposition', 'conjunction', 'interjection',
  'numeral', 'idiom', 'phrase', 'prefix', 'suffix', 'abbreviation',
  'symbol', 'other',
]

const labels: Record<PartOfSpeechKey, { vi: string; en: string }> = {
  noun: { vi: 'Danh từ', en: 'Noun' },
  properNoun: { vi: 'Danh từ riêng', en: 'Proper noun' },
  verb: { vi: 'Động từ', en: 'Verb' },
  phrasalVerb: { vi: 'Cụm động từ', en: 'Phrasal verb' },
  adjective: { vi: 'Tính từ', en: 'Adjective' },
  adverb: { vi: 'Trạng từ', en: 'Adverb' },
  pronoun: { vi: 'Đại từ', en: 'Pronoun' },
  determiner: { vi: 'Từ hạn định', en: 'Determiner / article' },
  preposition: { vi: 'Giới từ', en: 'Preposition' },
  conjunction: { vi: 'Liên từ', en: 'Conjunction' },
  interjection: { vi: 'Thán từ', en: 'Interjection' },
  numeral: { vi: 'Số từ', en: 'Numeral' },
  idiom: { vi: 'Thành ngữ / tục ngữ', en: 'Idiom / proverb' },
  phrase: { vi: 'Cụm từ', en: 'Phrase / expression' },
  prefix: { vi: 'Tiền tố', en: 'Prefix' },
  suffix: { vi: 'Hậu tố', en: 'Suffix' },
  abbreviation: { vi: 'Chữ viết tắt', en: 'Abbreviation' },
  symbol: { vi: 'Ký hiệu', en: 'Symbol / letter' },
  other: { vi: 'Loại khác', en: 'Other' },
}

export function identifyPartOfSpeech(label: string): PartOfSpeechKey {
  // Skypedia labels often look like 'N · countable' or 'V · vt'.
  const normalized = (label || '').toLocaleLowerCase('en')
    .split('·')[0].trim()
    .replace(/[._]/g, '')
    .replace(/\s+/g, ' ')

  if (/^(proper noun|proper name|danh từ riêng|tên riêng)/.test(normalized)) return 'properNoun'
  if (/^(phrasal verb|cụm động từ)/.test(normalized)) return 'phrasalVerb'
  if (/^(idiom|proverb|thành ngữ|tục ngữ|idiomatic expression)/.test(normalized)) return 'idiom'
  if (/^(noun|nouns|noun phrase|common noun|n|nn|danh từ|dt)$/.test(normalized) || /^noun\b/.test(normalized)) return 'noun'
  if (/^(verb|v|vi|vt|vtr|vintr|aux|auxiliary verb|transitive verb|intransitive verb|verb phrase|động từ)$/.test(normalized) || /^verb\b/.test(normalized)) return 'verb'
  if (/^(adjective|adj|a|tính từ)$/.test(normalized) || /^adjective\b/.test(normalized)) return 'adjective'
  if (/^(adverb|adv|d|trạng từ|phó từ)$/.test(normalized) || /^adverb\b/.test(normalized)) return 'adverb'
  if (/^(pronoun|pron|đại từ)$/.test(normalized)) return 'pronoun'
  if (/^(article|determiner|det|mạo từ|từ hạn định)$/.test(normalized)) return 'determiner'
  if (/^(preposition|prep|giới từ)$/.test(normalized)) return 'preposition'
  if (/^(conjunction|conj|liên từ)$/.test(normalized)) return 'conjunction'
  if (/^(interjection|interj|intj|exclamation|thán từ)$/.test(normalized)) return 'interjection'
  if (/^(numeral|number|num|số từ)$/.test(normalized)) return 'numeral'
  if (/^(phrase|expression|collocation|cụm từ)$/.test(normalized)) return 'phrase'
  if (/^(prefix|tiền tố)$/.test(normalized)) return 'prefix'
  if (/^(suffix|hậu tố)$/.test(normalized)) return 'suffix'
  if (/^(abbreviation|abbr|acronym|initialism|chữ viết tắt)$/.test(normalized)) return 'abbreviation'
  if (/^(symbol|letter|character|punctuation|ký hiệu)$/.test(normalized)) return 'symbol'

  return 'other'
}

/** Stable ordering across dictionaries; original sense order is kept inside each group. */
export function groupSensesByPartOfSpeech(
  senses: readonly Sense[], language: 'vi' | 'en',
): SenseGroup[] {
  const groups = new Map<PartOfSpeechKey, Sense[]>()
  for (const sense of senses) {
    const key = identifyPartOfSpeech(sense.partOfSpeech)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(sense)
  }
  return groupOrder
    .filter((key) => groups.has(key))
    .map((key) => ({ key, label: labels[key][language], senses: groups.get(key)! }))
}

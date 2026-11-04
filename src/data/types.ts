export interface Sense {
  /** Source IDs correspond to the dictionary manifest and sources page. */
  definition: string
  partOfSpeech: string
  example?: string
  exampleTranslation?: string
  tags?: string[]
  source?: string
}

export interface DictionaryEntry {
  headword: string
  /** Fallback IPA pronunciation. */
  ipa?: string
  /** British and American IPA, when source data distinguishes them. */
  ipaUk?: string
  ipaUs?: string
  en: Sense[]
  vi: Sense[]
}

export interface JapaneseExample {
  ja: string
  vi: string
}

/**
 * Vietnamese meanings come from Bunchaway, Japanese definitions from Japanese Wiktionary,
 * forms and parts of speech from JMdict, examples from Tatoeba.
 */
export interface JapaneseEntry {
  id: string
  /** Written (kanji) forms, most common first; empty for kana-only words. */
  forms: string[]
  readings: string[]
  common?: boolean
  vi: string[]
  ja?: string[]
  /** JMdict part-of-speech codes across all senses, in order. */
  pos: string[]
  examples?: JapaneseExample[]
}

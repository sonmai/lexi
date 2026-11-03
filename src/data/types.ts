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

/** A JMdict sense: JMdict part-of-speech and misc codes, English glosses joined by "; ". */
export interface JapaneseSense {
  pos: string[]
  gloss: string
  tags?: string[]
}

export interface JapaneseExample {
  ja: string
  vi: string
}

/** Vietnamese meanings come from Bunchaway, English senses from JMdict, examples from Tatoeba. */
export interface JapaneseEntry {
  id: string
  /** Written (kanji) forms, most common first; empty for kana-only words. */
  forms: string[]
  readings: string[]
  common?: boolean
  vi: string[]
  en: JapaneseSense[]
  examples?: JapaneseExample[]
}

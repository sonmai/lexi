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

export interface Sense {
  /** Raw meaning in the target language; senses from different sources are not forced to align. */
  definition: string
  partOfSpeech: string
  example?: string
  exampleTranslation?: string
}

export interface DictionaryEntry {
  headword: string
  ipa?: string
  en: Sense[]
  vi: Sense[]
}

import entries from './entries.json'
import type { DictionaryEntry } from './types'
import { normaliseEnglish } from '../utils/english'

// The checked-in dataset is intentionally small and original: a UI prototype,
// NOT an imported/licensed production dictionary. It is used only when a build
// has no generated dictionary data (LEXI_SKIP_IMPORT=1 or a clean `npm run dev`).
export const demoEntries = (entries as DictionaryEntry[]).sort((a, b) =>
  a.headword.localeCompare(b.headword, 'en')
)

export const demoByHeadword = new Map(
  demoEntries.map((entry) => [normaliseEnglish(entry.headword), entry])
)

export const demoWords = [...demoByHeadword.keys()].sort()

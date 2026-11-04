import { Volume2 } from 'lucide-react'
import type { DictionaryEntry, Sense } from '../data/types'
import { groupSensesByPartOfSpeech } from '../utils/partOfSpeech'

const sourceLabels: Record<string, string> = {
  skypedia: 'Skypedia', viwiktionary: 'Wiktionary Việt',
  enwiktionary: 'Wiktionary', wordnet: 'WordNet',
}

function DefinitionList({ senses, language }: { senses: Sense[]; language: 'vi' | 'en' }) {
  if (senses.length === 0) {
    return <p className="empty-language">Chưa có định nghĩa {language === 'vi' ? 'tiếng Việt' : 'tiếng Anh'} cho từ này.</p>
  }

  const groups = groupSensesByPartOfSpeech(senses, language)

  return (
    <div className="pos-groups">
      {groups.map((group) => (
        <section className="pos-group" key={group.key} aria-label={group.label}>
          <h4 className="pos-heading">{group.label}</h4>
          <ol className="sense-list">
            {group.senses.map((sense, index) => (
              <li className="sense-item" key={index}>
                <span className="sense-index" aria-hidden="true">{index + 1}.</span>
                <div className="sense-copy">
                  <p className="sense-definition">{sense.definition}</p>
                  {group.key === 'other' && sense.partOfSpeech && sense.partOfSpeech !== 'other' && (
                    <span className="sense-original-pos">{sense.partOfSpeech}</span>
                  )}
                  {sense.tags && sense.tags.length > 0 && (
                    <div className="usage-labels">{sense.tags.map((tag) => (
                      <span key={tag} className="usage-label">{tag}</span>
                    ))}</div>
                  )}
                  {sense.example && (
                    <div className="sense-example">
                      <p>{sense.example}</p>
                      {sense.exampleTranslation && (
                        <p className="example-translation">{sense.exampleTranslation}</p>
                      )}
                    </div>
                  )}
                  {sense.source && <p className="sense-source">{sourceLabels[sense.source] || sense.source}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

type Accent = 'en-GB' | 'en-US'

function PronunciationItem({
  ipa, accent, word, speak, canSpeak, label,
}: {
  ipa?: string
  accent: Accent
  word: string
  speak: (accent: Accent) => void
  canSpeak: boolean
  label?: string
}) {
  const localeLabel = label || 'English'
  return (
    <div className={`pronunciation-item${!label ? ' pronunciation-item-single' : ''}${!ipa ? ' pronunciation-item-no-ipa' : ''}`}>
      {label && <span className="pronunciation-accent">{label}</span>}
      {ipa && <span className="pronunciation-ipa">{ipa}</span>}
      <button
        type="button"
        className="pronunciation-play"
        onClick={() => speak(accent)}
        aria-label={`Phát âm ${word} – ${localeLabel}`}
        title={`Nghe phát âm ${localeLabel}`}
        disabled={!canSpeak}
      >
        <Volume2 size={19} strokeWidth={1.9} aria-hidden="true" />
      </button>
    </div>
  )
}

export function EnglishResult({
  entry, speak, canSpeak,
}: {
  entry: DictionaryEntry
  speak: (accent: Accent) => void
  canSpeak: boolean
}) {
  const hasRegionalIPA = Boolean(entry.ipaUk || entry.ipaUs)
  return (
    <article className="dictionary-result">
      <div className="entry-heading">
        <h2>{entry.headword}</h2>
        <div className="entry-pronunciations" aria-label="Phiên âm và phát âm tiếng Anh">
          {hasRegionalIPA ? (
            <>
              {entry.ipaUk && (
                <PronunciationItem ipa={entry.ipaUk} accent="en-GB" word={entry.headword}
                  label="UK" speak={speak} canSpeak={canSpeak} />
              )}
              {entry.ipaUs && (
                <PronunciationItem ipa={entry.ipaUs} accent="en-US" word={entry.headword}
                  label="US" speak={speak} canSpeak={canSpeak} />
              )}
            </>
          ) : (
            <PronunciationItem ipa={entry.ipa} accent="en-GB" word={entry.headword}
              speak={speak} canSpeak={canSpeak} />
          )}
        </div>
      </div>
      <div className="definition-columns">
        <section className="definition-column" aria-labelledby="vi-heading">
          <div className="definition-heading">
            <h3 id="vi-heading">Anh – Việt</h3>
            <span>Vietnamese</span>
          </div>
          <DefinitionList senses={entry.vi} language="vi" />
        </section>
        <section className="definition-column" aria-labelledby="en-heading">
          <div className="definition-heading">
            <h3 id="en-heading">English – English</h3>
            <span>Definitions</span>
          </div>
          <DefinitionList senses={entry.en} language="en" />
        </section>
      </div>
    </article>
  )
}

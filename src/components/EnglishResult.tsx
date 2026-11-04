import { useState } from 'react'
import { ChevronDown, Volume2 } from 'lucide-react'
import type { DictionaryEntry, Sense } from '../data/types'
import { groupSensesByPartOfSpeech, type SenseGroup as SenseGroupData } from '../utils/partOfSpeech'

const sourceLabels: Record<string, string> = {
  skypedia: 'Skypedia', viwiktionary: 'Wiktionary Việt',
  enwiktionary: 'Wiktionary', wordnet: 'WordNet',
}

/** Groups longer than this show their first `COLLAPSED_SENSES` senses until expanded. */
const MAX_UNCOLLAPSED_SENSES = 6
const COLLAPSED_SENSES = 4

function SenseGroup({ group }: { group: SenseGroupData }) {
  const [expanded, setExpanded] = useState(false)
  const collapsed = group.senses.length > MAX_UNCOLLAPSED_SENSES && !expanded
  const visible = collapsed ? group.senses.slice(0, COLLAPSED_SENSES) : group.senses
  return (
    <section className="pos-group" aria-label={group.label}>
      <h4 className="pos-heading">{group.label}</h4>
      <ol className="sense-list">
        {visible.map((sense, index) => (
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
                  <p lang="en">{sense.example}</p>
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
      {collapsed && (
        <button type="button" className="show-more" onClick={() => setExpanded(true)}>
          Xem thêm {group.senses.length - visible.length} nghĩa
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      )}
    </section>
  )
}

function DefinitionList({ senses, language }: { senses: Sense[]; language: 'vi' | 'en' }) {
  if (senses.length === 0) {
    return (
      <p className="empty-language" lang="vi">
        Chưa có định nghĩa {language === 'vi' ? 'tiếng Việt' : 'tiếng Anh'} cho từ này.
      </p>
    )
  }
  return (
    <div className="pos-groups">
      {groupSensesByPartOfSpeech(senses, language).map((group) => <SenseGroup key={group.key} group={group} />)}
    </div>
  )
}

type Accent = 'en-GB' | 'en-US'

function PronunciationItem({
  ipa, accent, word, speak, canSpeak, speaking, label,
}: {
  ipa?: string
  accent: Accent
  word: string
  speak: (accent: Accent) => void
  canSpeak: boolean
  speaking: boolean
  label?: string
}) {
  const localeLabel = label || 'English'
  return (
    <div className={`pronunciation-item${!label ? ' pronunciation-item-single' : ''}${!ipa ? ' pronunciation-item-no-ipa' : ''}`}>
      {label && <span className="pronunciation-accent">{label}</span>}
      {ipa && <span className="pronunciation-ipa">{ipa}</span>}
      <button
        type="button"
        className={'pronunciation-play' + (speaking ? ' pronunciation-play-speaking' : '')}
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
  entry, speak, canSpeak, speakingAccent,
}: {
  entry: DictionaryEntry
  speak: (accent: Accent) => void
  canSpeak: boolean
  /** The accent whose pronunciation of this headword is playing. */
  speakingAccent?: string
}) {
  const hasRegionalIPA = Boolean(entry.ipaUk || entry.ipaUs)
  return (
    <article className="dictionary-result">
      <div className="entry-heading">
        <h2 lang="en">{entry.headword}</h2>
        <div className="entry-pronunciations" aria-label="Phiên âm và phát âm tiếng Anh">
          {hasRegionalIPA ? (
            <>
              {entry.ipaUk && (
                <PronunciationItem ipa={entry.ipaUk} accent="en-GB" word={entry.headword}
                  label="UK" speak={speak} canSpeak={canSpeak} speaking={speakingAccent === 'en-GB'} />
              )}
              {entry.ipaUs && (
                <PronunciationItem ipa={entry.ipaUs} accent="en-US" word={entry.headword}
                  label="US" speak={speak} canSpeak={canSpeak} speaking={speakingAccent === 'en-US'} />
              )}
            </>
          ) : (
            <PronunciationItem ipa={entry.ipa} accent="en-GB" word={entry.headword}
              speak={speak} canSpeak={canSpeak} speaking={speakingAccent === 'en-GB'} />
          )}
        </div>
      </div>
      {entry.vi.length > 0 && entry.en.length > 0 && (
        <nav className="meaning-links" aria-label="Đi đến phần nghĩa">
          <a href="#vi-heading">Nghĩa Việt</a>
          <a href="#en-heading">Nghĩa Anh</a>
        </nav>
      )}
      <div className="definition-columns">
        <section className="definition-column" aria-labelledby="vi-heading">
          <div className="definition-heading">
            <h3 id="vi-heading">Anh – Việt</h3>
            <span>Vietnamese</span>
          </div>
          <DefinitionList senses={entry.vi} language="vi" />
        </section>
        <section className="definition-column" aria-labelledby="en-heading" lang="en">
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

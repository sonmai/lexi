import { useState } from 'react'
import { flushSync } from 'react-dom'
import { Volume2 } from 'lucide-react'
import type { JapaneseEntry } from '../data/types'
import type { JapaneseLookup } from '../dictionary-service'
import { isKanji, japanesePartOfSpeech } from '../utils/japanese'

const COLLAPSED_JAPANESE_ENTRIES = 8

const entryId = (entry: JapaneseEntry) => 'ja-entry-' + entry.id

/**
 * KANJIDIC2 "vietnam" readings are not ordered by frequency (本: Bổn, Bản) and mix in
 * Nôm readings (強: Cường… Gắng), so ambiguous characters list their first few readings.
 */
function hanViet(form: string, kanji: Record<string, string[]>): { text: string; full: string } {
  const characters = [...form].filter((ch) => isKanji(ch) && kanji[ch])
  const full = characters.map((ch) => ch + ' ' + kanji[ch].join(', ')).join('; ')
  if (characters.every((ch) => kanji[ch].length === 1)) {
    return { text: characters.map((ch) => kanji[ch][0]).join(' ').toLocaleUpperCase('vi'), full }
  }
  const text = characters.map((ch) => {
    const readings = kanji[ch]
    return ch + ' ' + readings.slice(0, 3).join('/') + (readings.length > 3 ? '…' : '')
  }).join(' · ')
  return { text, full }
}

function JapaneseEntryView({
  entry, kanji, speak, canSpeak, speakingText,
}: {
  entry: JapaneseEntry
  kanji: Record<string, string[]>
  speak: (text: string) => void
  canSpeak: boolean
  speakingText?: string
}) {
  const headword = entry.forms[0] ?? entry.readings[0] ?? ''
  const spoken = entry.readings[0] ?? headword
  const reading = entry.forms.length ? entry.readings.join('、') : entry.readings.slice(1).join('、')
  const sinoVietnamese = hanViet(headword, kanji)
  const otherForms = entry.forms.slice(1)
  const partsOfSpeech = [...new Set(entry.pos.map(japanesePartOfSpeech))]
  return (
    <section className="japanese-entry" id={entryId(entry)} aria-label={headword}>
      <div className="entry-heading">
        <h2 lang="ja">{headword}</h2>
        {reading && <span className="japanese-reading" lang="ja">{reading}</span>}
        <button
          type="button"
          className={'pronunciation-play' + (speakingText === spoken ? ' pronunciation-play-speaking' : '')}
          onClick={() => speak(spoken)}
          aria-label={`Phát âm ${headword} – tiếng Nhật`}
          title="Nghe phát âm tiếng Nhật"
          disabled={!canSpeak}
        >
          <Volume2 size={19} strokeWidth={1.9} aria-hidden="true" />
        </button>
      </div>
      {(sinoVietnamese.text || partsOfSpeech.length > 0 || otherForms.length > 0 || entry.common) && (
        <div className="japanese-details">
          {partsOfSpeech.length > 0 && (
            <p>
              <span className="detail-label">Từ loại</span>
              <span>{partsOfSpeech.join(' · ')}</span>
            </p>
          )}
          {sinoVietnamese.text && (
            <p>
              <span className="detail-label">Hán Việt</span>
              <span className="han-viet" title={'KANJIDIC2: ' + sinoVietnamese.full}>{sinoVietnamese.text}</span>
            </p>
          )}
          {otherForms.length > 0 && (
            <p>
              <span className="detail-label">Cách viết khác</span>
              <span lang="ja">{otherForms.join('、')}</span>
            </p>
          )}
          {entry.common && <span className="usage-label">Thông dụng</span>}
        </div>
      )}
      <section className="japanese-meanings" aria-label="Nhật – Việt">
        <div className="definition-heading">
          <h3>Nhật – Việt</h3>
          <span>Bunchaway</span>
        </div>
        <ol className="sense-list">
          {entry.vi.map((meaning, index) => (
            <li className="sense-item" key={index}>
              <span className="sense-index" aria-hidden="true">{index + 1}.</span>
              <p className="sense-definition">{meaning}</p>
            </li>
          ))}
        </ol>
      </section>
      {entry.ja && entry.ja.length > 0 && (
        <section className="japanese-meanings japanese-monolingual" aria-label="Nhật – Nhật">
          <div className="definition-heading">
            <h3>Nhật – Nhật</h3>
            <span>Wiktionary</span>
          </div>
          <ol className="sense-list" lang="ja">
            {entry.ja.map((definition, index) => (
              <li className="sense-item" key={index}>
                <span className="sense-index" aria-hidden="true">{index + 1}.</span>
                <p className="sense-definition">{definition}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
      {entry.examples && entry.examples.length > 0 && (
        <section className="japanese-examples" aria-label="Câu ví dụ">
          <h3>Ví dụ <span>Tatoeba</span></h3>
          {entry.examples.map((example) => (
            <div className="sense-example" key={example.ja}>
              <p lang="ja">{example.ja}</p>
              <p className="example-translation">{example.vi}</p>
            </div>
          ))}
        </section>
      )}
    </section>
  )
}

export function JapaneseResult({
  lookup, kanji, speak, canSpeak, speakingText,
}: {
  lookup: JapaneseLookup
  kanji: Record<string, string[]>
  speak: (text: string) => void
  canSpeak: boolean
  /** The Japanese text whose pronunciation is playing. */
  speakingText?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? lookup.entries : lookup.entries.slice(0, COLLAPSED_JAPANESE_ENTRIES)

  function jumpTo(entry: JapaneseEntry) {
    if (!visible.includes(entry)) flushSync(() => setExpanded(true))
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(entryId(entry))?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
  }

  return (
    <article className="dictionary-result japanese-result">
      {lookup.entries.length > 1 && (
        <nav className="japanese-summary" aria-label={`${lookup.entries.length} mục cho ${lookup.headword}`}>
          <span>{lookup.entries.length} mục:</span>
          <div className="word-chips" lang="ja">
            {lookup.entries.map((entry) => (
              <button type="button" key={entry.id} onClick={() => jumpTo(entry)}>
                {entry.forms[0] ?? entry.readings[0]}
              </button>
            ))}
          </div>
        </nav>
      )}
      {visible.map((entry) => (
        <JapaneseEntryView key={entry.id} entry={entry} kanji={kanji} speak={speak} canSpeak={canSpeak}
          speakingText={speakingText} />
      ))}
      {!expanded && lookup.entries.length > visible.length && (
        <button type="button" className="offline-action japanese-more" onClick={() => setExpanded(true)}>
          Xem thêm {lookup.entries.length - visible.length} mục
        </button>
      )}
    </article>
  )
}

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine, BookOpen, Check, Command, Search, Volume2, X,
} from 'lucide-react'
import {
  downloadForOffline, getManifest, loadJapaneseWords, loadKanjiReadings, loadWords,
  lookupJapanese, lookupWord, offlineProgress, suggest, suggestJapanese,
  type JapaneseLookup,
} from './dictionary-service'
import type { DictionaryEntry, JapaneseEntry, Sense } from './data/types'
import { groupSensesByPartOfSpeech } from './utils/partOfSpeech'
import {
  containsJapanese, isKanji, japanesePartOfSpeech, normalizeJapanese,
} from './utils/japanese'

const sourceLabels: Record<string, string> = {
  skypedia: 'Skypedia', viwiktionary: 'Wiktionary Việt',
  enwiktionary: 'Wiktionary', wordnet: 'WordNet',
}

type Mode = 'en' | 'ja'
type LookupResult = { mode: 'en'; entry: DictionaryEntry } | { mode: 'ja'; lookup: JapaneseLookup }

function initialWord(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('q')?.trim()
  return fromUrl || ''
}

function initialMode(): Mode {
  const params = new URLSearchParams(window.location.search)
  return params.get('lang') === 'ja' || containsJapanese(params.get('q') || '') ? 'ja' : 'en'
}

const COLLAPSED_JAPANESE_ENTRIES = 8

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

function DictionaryResult({
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
  entry, kanji, speak, canSpeak,
}: {
  entry: JapaneseEntry
  kanji: Record<string, string[]>
  speak: (text: string) => void
  canSpeak: boolean
}) {
  const headword = entry.forms[0] ?? entry.readings[0] ?? ''
  const reading = entry.forms.length ? entry.readings.join('、') : entry.readings.slice(1).join('、')
  const sinoVietnamese = hanViet(headword, kanji)
  const otherForms = entry.forms.slice(1)
  const partsOfSpeech = [...new Set(entry.pos.map(japanesePartOfSpeech))]
  return (
    <section className="japanese-entry" aria-label={headword}>
      <div className="entry-heading">
        <h2 lang="ja">{headword}</h2>
        {reading && <span className="japanese-reading" lang="ja">{reading}</span>}
        <button
          type="button"
          className="pronunciation-play"
          onClick={() => speak(entry.readings[0] ?? headword)}
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

function JapaneseResult({
  lookup, kanji, speak, canSpeak,
}: {
  lookup: JapaneseLookup
  kanji: Record<string, string[]>
  speak: (text: string) => void
  canSpeak: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? lookup.entries : lookup.entries.slice(0, COLLAPSED_JAPANESE_ENTRIES)
  return (
    <article className="dictionary-result japanese-result">
      {lookup.entries.length > 1 && (
        <p className="japanese-summary">
          {lookup.entries.length} mục cho “<span lang="ja">{lookup.headword}</span>”
        </p>
      )}
      {visible.map((entry) => (
        <JapaneseEntryView key={entry.id} entry={entry} kanji={kanji} speak={speak} canSpeak={canSpeak} />
      ))}
      {!expanded && lookup.entries.length > visible.length && (
        <button type="button" className="offline-action japanese-more" onClick={() => setExpanded(true)}>
          Xem thêm {lookup.entries.length - visible.length} mục
        </button>
      )}
    </article>
  )
}

export default function App() {
  const [query, setQuery] = useState(initialWord)
  const [selectedWord, setSelectedWord] = useState(initialWord)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [headwords, setHeadwords] = useState<string[]>([])
  const [japaneseWords, setJapaneseWords] = useState<string[]>([])
  const [kanji, setKanji] = useState<Record<string, string[]>>({})
  const [result, setResult] = useState<LookupResult | null>(null)
  const [indexError, setIndexError] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [loading, setLoading] = useState(() => Boolean(initialWord()))
  const [indexReady, setIndexReady] = useState(false)
  const [japaneseState, setJapaneseState] = useState<'idle' | 'loading' | 'ready' | 'missing'>('idle')
  const [wordCount, setWordCount] = useState(0)
  const [japaneseCount, setJapaneseCount] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [canSpeak, setCanSpeak] = useState(false)
  const [offline, setOffline] = useState({ saved: 0, total: 0 })
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  const searchRoot = useRef<HTMLFormElement>(null)
  const japaneseRequested = useRef(false)
  const suggestionId = useId()

  const suggestions = useMemo(
    () => mode === 'ja' ? suggestJapanese(japaneseWords, query) : suggest(headwords, query),
    [mode, headwords, japaneseWords, query],
  )
  const nearbyWords = useMemo(() => {
    if (mode === 'ja') {
      const selected = normalizeJapanese(selectedWord)
      return suggestJapanese(japaneseWords, selectedWord, 10)
        .filter((word) => normalizeJapanese(word) !== selected)
        .slice(0, 8)
    }
    return suggest(headwords, selectedWord, 10)
      .filter((word) => word.toLowerCase() !== selectedWord.toLowerCase())
      .slice(0, 8)
  }, [mode, headwords, japaneseWords, selectedWord])
  const suggestionVisible = showSuggestions && query.trim().length > 0
  const suggestionsReady = mode === 'ja' ? japaneseState === 'ready' || japaneseState === 'missing' : indexReady
  const offlineReady = offline.total > 0 && offline.saved === offline.total

  useEffect(() => {
    let live = true
    setCanSpeak('speechSynthesis' in window)

    const keyHandler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInput.current?.focus()
        searchInput.current?.select()
      }
      if (event.key === 'Escape') {
        setShowSuggestions(false)
        searchInput.current?.blur()
      }
    }
    const outsideHandler = (event: PointerEvent) => {
      if (searchRoot.current && !searchRoot.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    const historyHandler = () => {
      const word = initialWord()
      setSelectedWord(word)
      setQuery(word)
      setMode(initialMode())
      setShowSuggestions(false)
    }
    document.addEventListener('keydown', keyHandler)
    document.addEventListener('pointerdown', outsideHandler)
    window.addEventListener('popstate', historyHandler)

    void (async () => {
      try {
        const words = await loadWords()
        if (!live) return
        setHeadwords(words)
        setIndexReady(true)
        const manifest = await getManifest()
        if (!live) return
        setWordCount(manifest?.index ? manifest.count : words.length)
        setJapaneseCount(manifest?.japanese?.count ?? 0)
        setOffline(await offlineProgress())
      } catch (error) {
        if (live) setIndexError(error instanceof Error ? error.message : 'Không thể tải danh sách từ.')
      }
    })()

    return () => {
      live = false
      document.removeEventListener('keydown', keyHandler)
      document.removeEventListener('pointerdown', outsideHandler)
      window.removeEventListener('popstate', historyHandler)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'ja' || japaneseRequested.current) return
    japaneseRequested.current = true
    setJapaneseState('loading')
    void Promise.all([loadJapaneseWords(), loadKanjiReadings()]).then(([words, readings]) => {
      setJapaneseWords(words)
      setKanji(readings)
      setJapaneseState(words.length ? 'ready' : 'missing')
    }).catch((error) => {
      japaneseRequested.current = false
      setJapaneseState('idle')
      setIndexError(error instanceof Error ? error.message : 'Không thể tải danh sách từ tiếng Nhật.')
    })
  }, [mode])

  useEffect(() => {
    let live = true
    setLookupError('')
    if (!selectedWord) {
      setResult(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const lookup: Promise<LookupResult | null> = mode === 'ja'
      ? lookupJapanese(selectedWord).then((found): LookupResult | null => found && { mode: 'ja', lookup: found })
      : lookupWord(selectedWord).then((found): LookupResult | null => found && { mode: 'en', entry: found })
    void lookup.then((found) => {
      if (live) setResult(found)
    }).catch((error) => {
      if (live) {
        setResult(null)
        setLookupError(error instanceof Error ? error.message : 'Không thể tải định nghĩa.')
      }
    }).finally(() => {
      if (live) setLoading(false)
    })
    return () => { live = false }
  }, [selectedWord, mode])

  function updateUrl(term: string, nextMode: Mode, push: boolean) {
    const url = new URL(window.location.href)
    if (term) url.searchParams.set('q', term)
    else url.searchParams.delete('q')
    if (nextMode === 'ja') url.searchParams.set('lang', 'ja')
    else url.searchParams.delete('lang')
    if (window.location.search === url.search) return
    if (push) window.history.pushState({}, '', url)
    else window.history.replaceState({}, '', url)
  }

  function chooseWord(word: string) {
    const term = word.trim()
    if (!term) return
    setSelectedWord(term)
    setQuery(term)
    setShowSuggestions(false)
    setActiveIndex(0)
    searchInput.current?.blur()
    updateUrl(term, mode, true)
  }

  function switchMode(nextMode: Mode) {
    if (nextMode === mode) return
    setMode(nextMode)
    setActiveIndex(0)
    updateUrl(selectedWord, nextMode, false)
    searchInput.current?.focus()
  }

  function speakText(text: string, lang: string) {
    if (!canSpeak) return
    window.speechSynthesis.cancel()
    const speech = new SpeechSynthesisUtterance(text)
    speech.lang = lang
    speech.rate = 0.9
    // Prefer a matching installed voice. If missing, browser TTS uses its fallback.
    const availableVoice = window.speechSynthesis.getVoices().find(
      (voice) => voice.lang.toLowerCase() === lang.toLowerCase(),
    )
    if (availableVoice) speech.voice = availableVoice
    window.speechSynthesis.speak(speech)
  }

  async function downloadDictionary() {
    setDownloading(true)
    setDownloadError('')
    try {
      await downloadForOffline((saved, total) => setOffline({ saved, total }))
      setOffline(await offlineProgress())
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Không thể tải dữ liệu offline.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#dictionary-content">Bỏ qua điều hướng</a>
      <header className="site-header">
        <div className="header-inner">
          <a className="wordmark" href="/" aria-label="Lexi — trang chủ">lexi<span>.</span></a>
          <form
            className="search-root"
            role="search"
            ref={searchRoot}
            onSubmit={(event) => {
              event.preventDefault()
              chooseWord(suggestions[activeIndex] ?? query)
            }}
          >
            <label className="sr-only" htmlFor="lookup-word">
              {mode === 'ja' ? 'Nhập từ tiếng Nhật' : 'Nhập từ tiếng Anh'}
            </label>
            <div className={'search-field ' + (showSuggestions ? 'search-field-active' : '')}>
              <Search size={21} strokeWidth={1.9} aria-hidden="true" />
              <input
                ref={searchInput}
                id="lookup-word"
                role="combobox"
                type="search"
                inputMode="search"
                autoComplete="off"
                spellCheck={false}
                value={query}
                lang={mode === 'ja' ? 'ja' : 'en'}
                placeholder={mode === 'ja' ? 'Nhập kanji, kana hoặc romaji...' : 'Nhập từ tiếng Anh để tra cứu...'}
                aria-autocomplete="list"
                aria-expanded={suggestionVisible}
                aria-controls={suggestionVisible ? suggestionId : undefined}
                aria-activedescendant={suggestionVisible && suggestions.length ? suggestionId + '-' + activeIndex : undefined}
                onFocus={() => setShowSuggestions(true)}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActiveIndex(0)
                  setShowSuggestions(true)
                  if (mode === 'en' && containsJapanese(event.target.value)) switchMode('ja')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' && suggestions.length) {
                    event.preventDefault()
                    setActiveIndex((previous) => (previous + 1) % suggestions.length)
                  } else if (event.key === 'ArrowUp' && suggestions.length) {
                    event.preventDefault()
                    setActiveIndex((previous) => (previous + suggestions.length - 1) % suggestions.length)
                  }
                }}
              />
              {query && (
                <button
                  className="clear-search"
                  type="button"
                  aria-label="Xóa từ đã nhập"
                  onClick={() => { setQuery(''); setActiveIndex(0); searchInput.current?.focus() }}
                >
                  <X size={18} strokeWidth={1.9} />
                </button>
              )}
              <span className="keyboard-hint" aria-hidden="true"><Command size={13} /> K</span>
              <button type="submit" className="lookup-submit" aria-label="Tra từ">
                <span>Tra</span>
                <Search size={19} aria-hidden="true" />
              </button>
            </div>
            {suggestionVisible && (
              <div className="suggestions" id={suggestionId} role="listbox" aria-label="Từ gợi ý">
                {suggestions.length ? suggestions.map((word, index) => (
                  <button
                    key={word}
                    id={suggestionId + '-' + index}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={'suggestion ' + (index === activeIndex ? 'suggestion-active' : '')}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseWord(word)}
                  >
                    <span lang={mode === 'ja' ? 'ja' : undefined}>{word}</span>
                    <span className="suggestion-arrow" aria-hidden="true">↗</span>
                  </button>
                )) : (
                  <p className="suggestion-message">
                    {mode === 'ja' && japaneseState === 'missing'
                      ? 'Bản này chưa có dữ liệu tiếng Nhật.'
                      : suggestionsReady ? 'Không tìm thấy từ bắt đầu bằng cụm này.' : 'Đang tải danh sách từ...'}
                  </p>
                )}
              </div>
            )}
          </form>
        </div>
      </header>

      <main className="main-content" id="dictionary-content">
        <h1 className="sr-only">Lexi — từ điển Anh–Việt, Anh–Anh và Nhật–Việt</h1>

        <div className="utility-row">
          <div className="utility-start">
            <div className="mode-switch" role="group" aria-label="Chọn từ điển">
              {([['en', 'Anh–Việt'], ['ja', 'Nhật–Việt']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={'mode-option' + (mode === value ? ' mode-option-active' : '')}
                  aria-pressed={mode === value}
                  onClick={() => switchMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="word-count">
              {indexError ? 'Không thể tải danh sách từ'
                : mode === 'ja' ? (japaneseCount ? japaneseCount.toLocaleString('en') + ' mục từ' : japaneseState === 'missing' ? 'Chưa có dữ liệu' : 'Đang tải dữ liệu...')
                : wordCount ? wordCount.toLocaleString('en') + ' mục từ' : 'Đang tải dữ liệu...'}
            </span>
          </div>
          <button
            className="offline-action"
            type="button"
            onClick={() => void downloadDictionary()}
            disabled={downloading || offlineReady || !offline.total}
            aria-label={offlineReady ? 'Từ điển đã có sẵn offline' : 'Tải từ điển để sử dụng offline'}
          >
            {offlineReady ? <Check size={17} /> : <ArrowDownToLine size={17} />}
            <span>{offlineReady ? 'Đã tải offline' : downloading ? offline.saved + '/' + offline.total + ' phần' : 'Tải từ điển offline'}</span>
          </button>
        </div>
        {(indexError || downloadError) && (
          <p className="inline-error" role="alert">{indexError || downloadError}</p>
        )}

        <div className="result-region" aria-live="polite" aria-busy={Boolean(selectedWord) && loading}>
          {!selectedWord ? null : loading ? (
            <div className="result-message"><h2>Đang tra từ...</h2></div>
          ) : lookupError ? (
            <div className="result-message" role="alert">
              <h2>Không thể tải định nghĩa</h2>
              <p>{lookupError}</p>
            </div>
          ) : result?.mode === 'en' ? (
            <DictionaryResult
              entry={result.entry}
              speak={(accent) => speakText(result.entry.headword, accent)}
              canSpeak={canSpeak}
            />
          ) : result?.mode === 'ja' ? (
            <JapaneseResult
              key={result.lookup.headword}
              lookup={result.lookup}
              kanji={kanji}
              speak={(text) => speakText(text, 'ja-JP')}
              canSpeak={canSpeak}
            />
          ) : (
            <div className="result-message">
              <BookOpen size={25} strokeWidth={1.6} aria-hidden="true" />
              <h2>Không tìm thấy từ</h2>
              <p>Hãy kiểm tra chính tả hoặc chọn một từ trong danh sách gợi ý.</p>
            </div>
          )}
        </div>
        {selectedWord && !loading && result && nearbyWords.length > 0 && (
          <nav className="related-lookup" aria-label="Các từ có cùng tiền tố">
            <h3>Các từ bắt đầu bằng “{result.mode === 'en' ? result.entry.headword : result.lookup.headword}”</h3>
            <div className="related-words" lang={result.mode === 'ja' ? 'ja' : undefined}>
              {nearbyWords.map((word) => (
                <button type="button" key={word} onClick={() => chooseWord(word)}>
                  {word}
                </button>
              ))}
            </div>
          </nav>
        )}

      </main>

      <footer className="site-footer">
        <span>Lexi Dictionary</span>
        <a href="/sources.html">Nguồn &amp; giấy phép dữ liệu</a>
      </footer>
    </div>
  )
}


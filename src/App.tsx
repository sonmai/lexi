import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine, BookOpen, Check, Command, Search, Volume2, X,
} from 'lucide-react'
import {
  downloadForOffline, getManifest, loadWords, lookupWord, offlineProgress, suggest,
} from './dictionary-service'
import type { DictionaryEntry, Sense } from './data/types'
import { groupSensesByPartOfSpeech } from './utils/partOfSpeech'

const sourceLabels: Record<string, string> = {
  skypedia: 'Skypedia', viwiktionary: 'Wiktionary Việt',
  enwiktionary: 'Wiktionary', wordnet: 'WordNet',
}

function initialWord(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('q')?.trim()
  return fromUrl || 'example'
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
    <div className="pronunciation-item">
      {ipa && <span className="pronunciation-ipa">{ipa}</span>}
      {label && <span className="pronunciation-accent">{label}</span>}
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

export default function App() {
  const [query, setQuery] = useState(initialWord)
  const [selectedWord, setSelectedWord] = useState(initialWord)
  const [headwords, setHeadwords] = useState<string[]>([])
  const [entry, setEntry] = useState<DictionaryEntry | null>(null)
  const [indexError, setIndexError] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [loading, setLoading] = useState(true)
  const [indexReady, setIndexReady] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [canSpeak, setCanSpeak] = useState(false)
  const [offline, setOffline] = useState({ saved: 0, total: 0 })
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  const searchRoot = useRef<HTMLFormElement>(null)
  const suggestionId = useId()

  const suggestions = useMemo(() => suggest(headwords, query), [headwords, query])
  const nearbyWords = useMemo(
    () => suggest(headwords, selectedWord, 10)
      .filter((word) => word.toLowerCase() !== selectedWord.toLowerCase())
      .slice(0, 8),
    [headwords, selectedWord],
  )
  const suggestionVisible = showSuggestions && query.trim().length > 0
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
      const word = new URLSearchParams(window.location.search).get('q')?.trim() || 'example'
      setSelectedWord(word)
      setQuery(word)
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
        setWordCount(manifest?.count ?? words.length)
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
    let live = true
    setLookupError('')
    setLoading(true)
    void lookupWord(selectedWord).then((result) => {
      if (live) setEntry(result)
    }).catch((error) => {
      if (live) {
        setEntry(null)
        setLookupError(error instanceof Error ? error.message : 'Không thể tải định nghĩa.')
      }
    }).finally(() => {
      if (live) setLoading(false)
    })
    return () => { live = false }
  }, [selectedWord])

  function chooseWord(word: string) {
    const term = word.trim()
    if (!term) return
    setSelectedWord(term)
    setQuery(term)
    setShowSuggestions(false)
    setActiveIndex(0)
    searchInput.current?.blur()
    const url = new URL(window.location.href)
    url.searchParams.set('q', term)
    if (window.location.search !== url.search) window.history.pushState({}, '', url)
  }

  function speakWord(accent: Accent) {
    if (!entry || !canSpeak) return
    window.speechSynthesis.cancel()
    const speech = new SpeechSynthesisUtterance(entry.headword)
    speech.lang = accent
    speech.rate = 0.9
    // Prefer a matching installed voice. If missing, browser TTS uses its fallback.
    const availableVoice = window.speechSynthesis.getVoices().find(
      (voice) => voice.lang.toLowerCase() === accent.toLowerCase(),
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
            <label className="sr-only" htmlFor="lookup-word">Nhập từ tiếng Anh</label>
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
                placeholder="Nhập từ tiếng Anh để tra cứu..."
                aria-autocomplete="list"
                aria-expanded={suggestionVisible}
                aria-controls={suggestionVisible ? suggestionId : undefined}
                aria-activedescendant={suggestionVisible && suggestions.length ? suggestionId + '-' + activeIndex : undefined}
                onFocus={() => setShowSuggestions(true)}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActiveIndex(0)
                  setShowSuggestions(true)
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
                    <span>{word}</span>
                    <span className="suggestion-arrow" aria-hidden="true">↗</span>
                  </button>
                )) : (
                  <p className="suggestion-message">
                    {indexReady ? 'Không tìm thấy từ bắt đầu bằng cụm này.' : 'Đang tải danh sách từ...'}
                  </p>
                )}
              </div>
            )}
          </form>
        </div>
      </header>

      <main className="main-content" id="dictionary-content">
        <h1 className="sr-only">Lexi — từ điển Anh–Việt và Anh–Anh</h1>

        <div className="utility-row">
          <span className="word-count">
            {indexError ? 'Không thể tải danh sách từ' : wordCount ? wordCount.toLocaleString('en') + ' mục từ' : 'Đang tải dữ liệu...'}
          </span>
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

        <div className="result-region" aria-live="polite" aria-busy={loading}>
          {loading ? (
            <div className="result-message"><h2>Đang tra từ...</h2></div>
          ) : lookupError ? (
            <div className="result-message" role="alert">
              <h2>Không thể tải định nghĩa</h2>
              <p>{lookupError}</p>
            </div>
          ) : entry ? (
            <DictionaryResult entry={entry} speak={speakWord} canSpeak={canSpeak} />
          ) : (
            <div className="result-message">
              <BookOpen size={25} strokeWidth={1.6} aria-hidden="true" />
              <h2>Không tìm thấy từ</h2>
              <p>Hãy kiểm tra chính tả hoặc chọn một từ trong danh sách gợi ý.</p>
            </div>
          )}
        </div>
        {!loading && entry && nearbyWords.length > 0 && (
          <nav className="related-lookup" aria-label="Các từ có cùng tiền tố">
            <h3>Các từ bắt đầu bằng “{entry.headword}”</h3>
            <div className="related-words">
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

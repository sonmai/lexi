import { useEffect, useRef, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { EnglishResult } from './components/EnglishResult'
import { JapaneseResult } from './components/JapaneseResult'
import { SearchBox } from './components/SearchBox'
import { JapanFlag, UnitedKingdomFlag } from './flags'
import { useDictionaryIndex, useKanjiReadings, useSuggestions } from './hooks/useDictionaryIndex'
import { useLookup } from './hooks/useLookup'
import { clearLookups, useRecentLookups } from './hooks/useRecentLookups'
import { navigate, useRoute, type Mode } from './hooks/useRoute'
import { useSpeech } from './hooks/useSpeech'
import { containsJapanese, normalizeJapanese } from './utils/japanese'

const DEFAULT_TITLE = document.title
// English mode switches to Japanese when kana or kanji is typed, so it shows one Japanese example too.
const EXAMPLES: Record<Mode, readonly string[]> = {
  en: ['serendipity', 'resilient', '食べる', 'ephemeral'],
  ja: ['食べる', 'たべる', 'taberu', '勉強'],
}

export default function App() {
  const { route, navigation } = useRoute()
  const { word: selectedWord, mode } = route
  // Typed text belongs to one navigation; any navigation, including Back, shows the route's word again.
  const [draft, setDraft] = useState<{ text: string; navigation: number } | null>(null)
  const query = draft?.navigation === navigation ? draft.text : route.word
  // Remounts the wordmark's dot so it hops again on every keystroke.
  const [keystrokes, setKeystrokes] = useState(0)
  const searchInput = useRef<HTMLInputElement>(null)

  const [retryAttempt, setRetryAttempt] = useState(0)
  const english = useDictionaryIndex('en', true, retryAttempt)
  const japanese = useDictionaryIndex('ja', mode === 'ja', retryAttempt)
  const index = mode === 'ja' ? japanese : english
  const indexReady = index.status === 'ready'
  const kanji = useKanjiReadings(japanese.status === 'ready')
  const suggestions = useSuggestions(mode, query, indexReady)
  const nearby = useSuggestions(mode, selectedWord, indexReady, 10)
  const { result, loading, error: lookupError } = useLookup(route, retryAttempt)
  const notFound = Boolean(selectedWord) && !loading && !lookupError && !result
  const similar = useSuggestions(mode, selectedWord, indexReady && notFound, 6, true)
  const { canSpeak, speak, speaking } = useSpeech()
  const recent = useRecentLookups(mode)
  const headword = result?.mode === 'en' ? result.entry.headword : result?.lookup.headword

  useEffect(() => {
    document.title = selectedWord ? `${headword ?? selectedWord} · Lexi` : DEFAULT_TITLE
  }, [selectedWord, headword])

  const nearbyWords = mode === 'ja'
    ? nearby.words.filter((word) => normalizeJapanese(word) !== normalizeJapanese(selectedWord)).slice(0, 8)
    : nearby.words.filter((word) => word.toLowerCase() !== selectedWord.toLowerCase()).slice(0, 8)
  // Longer words starting with what was typed come before spelling corrections.
  const didYouMean = [...new Set([...nearbyWords, ...similar.words])].slice(0, 6)
  const emptyMessage = index.status === 'missing'
    ? 'Bản này chưa có dữ liệu tiếng Nhật.'
    : indexReady && !suggestions.pending ? 'Không tìm thấy từ bắt đầu bằng cụm này.' : 'Đang tải danh sách từ...'
  const errors = [english.error, japanese.error].filter(Boolean)

  function chooseWord(word: string) {
    const term = word.trim()
    if (!term) return
    if ((lookupError && term === selectedWord) || index.status === 'error') {
      setRetryAttempt((attempt) => attempt + 1)
    }
    navigate({ word: term, mode }, true)
  }

  /** Clears the current lookup; `typed` keeps text that triggered the switch, such as kana typed in English mode. */
  function switchMode(nextMode: Mode, typed = '') {
    if (nextMode === mode) return
    // Pushing lets Back restore the cleared lookup.
    const next = navigate({ word: '', mode: nextMode }, Boolean(selectedWord))
    setDraft(typed ? { text: typed, navigation: next } : null)
    searchInput.current?.focus()
  }

  const home = !selectedWord
  const modeSwitch = (
    <div className="mode-switch" role="group" aria-label="Chọn từ điển">
      {([['en', 'Anh–Việt', UnitedKingdomFlag], ['ja', 'Nhật–Việt', JapanFlag]] as const).map(([value, label, Flag]) => (
        <button
          key={value}
          type="button"
          className={'mode-option' + (mode === value ? ' mode-option-active' : '')}
          aria-pressed={mode === value}
          onClick={() => switchMode(value)}
        >
          <Flag />
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <div className={'app-shell' + (home ? ' is-home' : '')}>
      <a className="skip-link" href="#dictionary-content">Bỏ qua điều hướng</a>
      <header className="site-header">
        <div className="header-inner">
          <a className="wordmark" href="/" aria-label="Lexi — trang chủ">
            lexi<span key={keystrokes} className={keystrokes ? 'wordmark-dot-hop' : undefined}>.</span>
          </a>
          <SearchBox
            mode={mode}
            query={query}
            busy={Boolean(selectedWord) && loading}
            examples={home ? EXAMPLES[mode] : undefined}
            onQueryChange={(value) => {
              setDraft({ text: value, navigation })
              setKeystrokes((count) => count + 1)
              if (mode === 'en' && containsJapanese(value)) switchMode('ja', value)
            }}
            lookedUp={selectedWord}
            suggestions={suggestions.pending ? [] : suggestions.words}
            emptyMessage={emptyMessage}
            onChoose={chooseWord}
            inputRef={searchInput}
          />
          {home && modeSwitch}
        </div>
      </header>

      <main className="main-content" id="dictionary-content">
        <h1 className="sr-only">Lexi — từ điển Anh–Việt, Anh–Anh và Nhật–Việt</h1>

        {!home && <div className="utility-row">{modeSwitch}</div>}
        {errors.length > 0 && <p className="inline-error" role="alert">{errors.join(' ')}</p>}

        {home && recent.length > 0 && (
          <section className="home" key={mode} aria-labelledby="home-heading">
            <div className="home-heading">
              <h2 id="home-heading">Tra gần đây</h2>
              <button type="button" className="text-action" onClick={() => clearLookups(mode)}>Xoá lịch sử</button>
            </div>
            <div className="word-chips" lang={mode === 'ja' ? 'ja' : 'en'}>
              {recent.map((word) => (
                <button type="button" key={word} onClick={() => chooseWord(word)}>{word}</button>
              ))}
            </div>
          </section>
        )}

        <div className="result-region" aria-live="polite" aria-busy={Boolean(selectedWord) && loading}>
          {!selectedWord ? null : loading ? (
            <div className="result-message result-loading"><h2>Đang tra từ...</h2></div>
          ) : lookupError ? (
            <div className="result-message" role="alert">
              <h2>Không thể tải định nghĩa</h2>
              <p>{lookupError}</p>
              <button type="button" className="retry-lookup" onClick={() => chooseWord(selectedWord)}>Thử lại</button>
            </div>
          ) : result?.mode === 'en' ? (
            <EnglishResult
              key={result.entry.headword}
              entry={result.entry}
              speak={(accent) => speak(result.entry.headword, accent)}
              canSpeak={canSpeak}
              speakingAccent={speaking?.text === result.entry.headword ? speaking.lang : undefined}
            />
          ) : result?.mode === 'ja' ? (
            <JapaneseResult
              key={result.lookup.headword}
              lookup={result.lookup}
              kanji={kanji}
              speak={(text) => speak(text, 'ja-JP')}
              canSpeak={canSpeak}
              speakingText={speaking?.lang === 'ja-JP' ? speaking.text : undefined}
            />
          ) : (
            <div className="result-message">
              <BookOpen size={25} strokeWidth={1.6} aria-hidden="true" />
              <h2>Không tìm thấy từ</h2>
              {didYouMean.length > 0 ? (
                <>
                  <p>Có phải bạn muốn tìm:</p>
                  <div className="word-chips" lang={mode === 'ja' ? 'ja' : 'en'}>
                    {didYouMean.map((word) => (
                      <button type="button" key={word} onClick={() => chooseWord(word)}>{word}</button>
                    ))}
                  </div>
                </>
              ) : (
                <p>Hãy kiểm tra lại chính tả hoặc thử một từ khác.</p>
              )}
            </div>
          )}
        </div>
        {selectedWord && !loading && result && nearbyWords.length > 0 && (
          <nav className="related-lookup" aria-label="Các từ có cùng tiền tố" key={selectedWord}>
            <h3>Các từ bắt đầu bằng “{result.mode === 'en' ? result.entry.headword : result.lookup.headword}”</h3>
            <div className="word-chips" lang={result.mode === 'ja' ? 'ja' : 'en'}>
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

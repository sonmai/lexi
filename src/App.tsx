import { useRef, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { EnglishResult } from './components/EnglishResult'
import { JapaneseResult } from './components/JapaneseResult'
import { OfflineButton } from './components/OfflineButton'
import { SearchBox } from './components/SearchBox'
import { JapanFlag, UnitedKingdomFlag } from './flags'
import { useDictionaryIndex, useKanjiReadings, useSuggestions } from './hooks/useDictionaryIndex'
import { useLookup } from './hooks/useLookup'
import { useOfflineDictionary } from './hooks/useOfflineDictionary'
import { navigate, useRoute, type Mode } from './hooks/useRoute'
import { useSpeech } from './hooks/useSpeech'
import { containsJapanese, normalizeJapanese } from './utils/japanese'

export default function App() {
  const { route, navigation } = useRoute()
  const { word: selectedWord, mode } = route
  // Typed text belongs to one navigation; any navigation, including Back, shows the route's word again.
  const [draft, setDraft] = useState<{ text: string; navigation: number } | null>(null)
  const query = draft?.navigation === navigation ? draft.text : route.word
  const searchInput = useRef<HTMLInputElement>(null)

  const english = useDictionaryIndex('en', true)
  const japanese = useDictionaryIndex('ja', mode === 'ja')
  const index = mode === 'ja' ? japanese : english
  const indexReady = index.status === 'ready'
  const kanji = useKanjiReadings(japanese.status === 'ready')
  const suggestions = useSuggestions(mode, query, indexReady)
  const nearby = useSuggestions(mode, selectedWord, indexReady, 10)
  const { result, loading, error: lookupError } = useLookup(route)
  const offline = useOfflineDictionary()
  const { canSpeak, speak } = useSpeech()

  const nearbyWords = mode === 'ja'
    ? nearby.words.filter((word) => normalizeJapanese(word) !== normalizeJapanese(selectedWord)).slice(0, 8)
    : nearby.words.filter((word) => word.toLowerCase() !== selectedWord.toLowerCase()).slice(0, 8)
  const emptyMessage = index.status === 'missing'
    ? 'Bản này chưa có dữ liệu tiếng Nhật.'
    : indexReady && !suggestions.pending ? 'Không tìm thấy từ bắt đầu bằng cụm này.' : 'Đang tải danh sách từ...'
  const errors = [english.error, japanese.error, offline.error].filter(Boolean)

  function chooseWord(word: string) {
    const term = word.trim()
    if (!term) return
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

  return (
    <div className="app-shell">
      <a className="skip-link" href="#dictionary-content">Bỏ qua điều hướng</a>
      <header className="site-header">
        <div className="header-inner">
          <a className="wordmark" href="/" aria-label="Lexi — trang chủ">lexi<span>.</span></a>
          <SearchBox
            mode={mode}
            query={query}
            onQueryChange={(value) => {
              setDraft({ text: value, navigation })
              if (mode === 'en' && containsJapanese(value)) switchMode('ja', value)
            }}
            suggestions={suggestions.words}
            emptyMessage={emptyMessage}
            onChoose={chooseWord}
            inputRef={searchInput}
          />
        </div>
      </header>

      <main className="main-content" id="dictionary-content">
        <h1 className="sr-only">Lexi — từ điển Anh–Việt, Anh–Anh và Nhật–Việt</h1>

        <div className="utility-row">
          <div className="utility-start">
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
            <span className="word-count">
              {index.status === 'error' ? 'Không thể tải danh sách từ'
                : index.status === 'missing' ? 'Chưa có dữ liệu'
                : indexReady ? index.count.toLocaleString('en') + ' mục từ' + (index.demo ? ' (bản demo)' : '')
                : 'Đang tải dữ liệu...'}
            </span>
          </div>
          <OfflineButton
            section={mode}
            status={offline.status[mode]}
            download={offline.download}
            onDownload={(section) => void offline.start(section)}
          />
        </div>
        {errors.length > 0 && <p className="inline-error" role="alert">{errors.join(' ')}</p>}
        {offline.mayBeEvicted && (
          <p className="inline-note">
            Trình duyệt có thể xoá dữ liệu offline khi thiếu dung lượng. Thêm Lexi vào màn hình chính để giữ lâu hơn.
          </p>
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
            <EnglishResult
              entry={result.entry}
              speak={(accent) => speak(result.entry.headword, accent)}
              canSpeak={canSpeak}
            />
          ) : result?.mode === 'ja' ? (
            <JapaneseResult
              key={result.lookup.headword}
              lookup={result.lookup}
              kanji={kanji}
              speak={(text) => speak(text, 'ja-JP')}
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

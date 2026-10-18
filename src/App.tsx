import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, BookA, BookOpen, Check, ChevronRight, Command,
  Languages, Search, Volume2, WifiOff, X
} from 'lucide-react'
import { byHeadword, dictionary, normalise, searchHeadwords } from './data/dictionary'
import type { DictionaryEntry, Sense } from './data/types'

const featuredWords = ['example', 'clarity', 'context', 'resilience', 'balance']

function MeaningList({ senses, language }: { senses: Sense[]; language: 'vi' | 'en' }) {
  if (!senses.length) {
    return <p className="missing-definition">No definition available in this language.</p>
  }
  return (
    <ol className="meaning-list">
      {senses.map((sense, index) => (
        <li className="meaning-item" key={index}>
          <span className="sense-number">{String(index + 1).padStart(2, '0')}</span>
          <div className="sense-content">
            <span className="part-of-speech">{sense.partOfSpeech}</span>
            <p className="definition">{sense.definition}</p>
            {sense.example && (
              <div className="example">
                <p className="example-english">“{sense.example}”</p>
                {language === 'vi' && sense.exampleTranslation && (
                  <p className="example-translation">{sense.exampleTranslation}</p>
                )}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function DefinitionCard({ title, subtitle, icon, senses, language }: {
  title: string
  subtitle: string
  icon: React.ReactNode
  senses: Sense[]
  language: 'vi' | 'en'
}) {
  return (
    <section className="definition-card" aria-label={title}>
      <div className="card-heading">
        <div className="card-icon">{icon}</div>
        <div><h2>{title}</h2><p>{subtitle}</p></div>
      </div>
      <MeaningList senses={senses} language={language} />
    </section>
  )
}

function EntryView({ entry, onSpeak }: { entry: DictionaryEntry; onSpeak: () => void }) {
  return (
    <div className="entry-view" key={entry.headword}>
      <div className="word-heading">
        <div className="word-heading-copy">
          <p className="eyebrow">DICTIONARY ENTRY</p>
          <h1>{entry.headword}</h1>
          <div className="pronunciation">
            {entry.ipa ? <span className="ipa">{entry.ipa}</span> : <span>Pronunciation unavailable</span>}
            <span className="pronunciation-dot" aria-hidden="true" />
            <span>English</span>
          </div>
        </div>
        <button className="sound-button" type="button" aria-label={`Pronounce ${entry.headword}`} onClick={onSpeak}>
          <Volume2 size={21} strokeWidth={1.9} />
        </button>
      </div>
      <div className="definitions-grid">
        <DefinitionCard
          title="Anh – Việt"
          subtitle="Vietnamese meanings"
          icon={<Languages size={20} />}
          senses={entry.vi}
          language="vi"
        />
        <DefinitionCard
          title="English – English"
          subtitle="English definitions"
          icon={<BookOpen size={20} />}
          senses={entry.en}
          language="en"
        />
      </div>
    </div>
  )
}

export default function App() {
  const [query, setQuery] = useState('example')
  const [selected, setSelected] = useState('example')
  const [isFocused, setIsFocused] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const [canSpeak, setCanSpeak] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(() => searchHeadwords(query), [query])
  const entry = byHeadword.get(normalise(selected))
  const displaySuggestions = isFocused && query.trim().length > 0

  useEffect(() => {
    setCanSpeak(typeof window !== 'undefined' && 'speechSynthesis' in window)
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
      if (event.key === 'Escape') {
        setIsFocused(false)
        inputRef.current?.blur()
      }
    }
    const onOutside = (event: PointerEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onOutside)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onOutside)
    }
  }, [])

  const selectWord = (headword: string) => {
    setSelected(headword)
    setQuery(headword)
    setIsFocused(false)
    setActiveSuggestion(0)
    inputRef.current?.blur()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitSearch = () => {
    const candidate = suggestions[activeSuggestion]?.headword ?? query.trim()
    if (candidate) selectWord(candidate)
  }

  const pronounce = () => {
    if (!entry || !canSpeak) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(entry.headword)
    utterance.lang = 'en-GB'
    utterance.rate = 0.86
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/" aria-label="Lexi dictionary home">
            <span className="brand-symbol"><BookA size={21} strokeWidth={2} /></span>
            <span>lexi<span className="brand-period">.</span></span>
          </a>
          <span className="topbar-description">A little more meaning, every day.</span>
          <div className="topbar-status"><span className="status-dot" /> Offline-first dictionary</div>
        </div>
      </header>

      <main className="page">
        <div className="intro">
          <div className="intro-tag"><span className="intro-tag-line" /> YOUR EVERYDAY DICTIONARY</div>
          <h2>Every word has <span>a story.</span></h2>
          <p>One simple search. Clear meanings in Vietnamese and English, side by side.</p>
        </div>

        <div className="search-area" ref={searchRef}>
          <div className={`search-bar ${isFocused ? 'search-bar-active' : ''}`}>
            <Search size={21} aria-hidden="true" className="search-icon" />
            <input
              ref={inputRef}
              type="search"
              inputMode="search"
              autoComplete="off"
              spellCheck={false}
              aria-label="Look up an English word"
              aria-expanded={displaySuggestions}
              aria-controls="word-suggestions"
              aria-autocomplete="list"
              placeholder="Search an English word..."
              value={query}
              onFocus={() => setIsFocused(true)}
              onChange={(event) => { setQuery(event.target.value); setActiveSuggestion(0); setIsFocused(true) }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' && suggestions.length) {
                  event.preventDefault()
                  setActiveSuggestion((index) => (index + 1) % suggestions.length)
                } else if (event.key === 'ArrowUp' && suggestions.length) {
                  event.preventDefault()
                  setActiveSuggestion((index) => (index + suggestions.length - 1) % suggestions.length)
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  submitSearch()
                }
              }}
            />
            {query && (
              <button className="clear-button" aria-label="Clear search" onClick={() => {
                setQuery('')
                setActiveSuggestion(0)
                inputRef.current?.focus()
              }} type="button"><X size={17} /></button>
            )}
            <div className="search-shortcut" aria-hidden="true"><Command size={13}/><span>K</span></div>
          </div>
          {displaySuggestions && (
            <div className="suggestion-popover" id="word-suggestions" role="listbox" aria-label="Suggested words">
              {suggestions.length > 0 ? suggestions.map((result, index) => (
                <button
                  key={result.headword}
                  className={`suggestion ${activeSuggestion === index ? 'suggestion-active' : ''}`}
                  type="button"
                  role="option"
                  aria-selected={activeSuggestion === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectWord(result.headword)}
                >
                  <BookOpen size={16}/><span>{result.headword}</span><ArrowRight size={16}/>
                </button>
              )) : (
                <div className="suggestion-empty">No matching word in the demo dataset.</div>
              )}
            </div>
          )}
        </div>

        <div className="workspace">
          <aside className="sidebar" aria-label="Dictionary shortcuts">
            <div className="sidebar-section">
              <div className="sidebar-title">EXPLORE</div>
              <div className="sidebar-item sidebar-item-selected"><BookOpen size={18} /><span>Dictionary</span><ChevronRight size={16}/></div>
            </div>
            <div className="sidebar-section sidebar-words">
              <div className="sidebar-title">WORDS TO EXPLORE</div>
              {featuredWords.map((word) => (
                <button className={`featured-word ${selected === word ? 'featured-active' : ''}`}
                  key={word} type="button" onClick={() => selectWord(word)}>
                  <span>{word}</span><ArrowRight size={15}/>
                </button>
              ))}
            </div>
            <div className="sidebar-bottom">
              <div className="sidebar-bottom-icon"><WifiOff size={18}/></div>
              <strong>Made for offline moments.</strong>
              <p>Install this website to revisit words without an internet connection after caching.</p>
            </div>
          </aside>

          <section className="result-panel" aria-live="polite">
            {entry ? (
              <EntryView entry={entry} onSpeak={pronounce} />
            ) : (
              <div className="not-found">
                <div className="not-found-icon"><Search size={26}/></div>
                <h1>No entry found</h1>
                <p>“{selected}” isn't in the small demo dataset yet. Try one of the suggested words.</p>
                <button type="button" onClick={() => selectWord('example')}>Explore “example” <ArrowRight size={16}/></button>
              </div>
            )}
            <div className="panel-footer">
              <div><Check size={15}/><span>English + Vietnamese in one place</span></div>
              <span>Prototype · {dictionary.length} curated entries</span>
            </div>
          </section>
        </div>
      </main>

      <footer className="footer">
        <span>lexi<span className="brand-period">.</span></span>
        <span>Thoughtfully simple. © {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}

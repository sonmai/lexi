import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { Search, X } from 'lucide-react'
import { useCoarsePointer } from '../hooks/useCoarsePointer'
import type { Mode } from '../hooks/useRoute'

const isApple = /Mac|iPhone|iPad/.test(navigator.platform)
const shortcutLabel = isApple ? '⌘ K' : 'Ctrl K'

export function SearchBox({
  mode, query, lookedUp, onQueryChange, suggestions, emptyMessage, onChoose, inputRef,
}: {
  mode: Mode
  query: string
  /** The word whose result is showing; suggestions stay closed while the query still equals it. */
  lookedUp: string
  onQueryChange: (value: string) => void
  suggestions: string[]
  /** Shown in the list when there are no suggestions for a non-empty query. */
  emptyMessage: string
  onChoose: (word: string) => void
  inputRef: RefObject<HTMLInputElement | null>
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const root = useRef<HTMLFormElement>(null)
  const suggestionId = useId()
  const coarsePointer = useCoarsePointer()
  const suggestionVisible = showSuggestions && query.trim().length > 0 && query !== lookedUp

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
      if (event.key === 'Escape') {
        setShowSuggestions(false)
        inputRef.current?.blur()
      }
    }
    const outsideHandler = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setShowSuggestions(false)
    }
    // Back/forward replaces the query; the list belongs to the previous one.
    const historyHandler = () => setShowSuggestions(false)
    document.addEventListener('keydown', keyHandler)
    document.addEventListener('pointerdown', outsideHandler)
    window.addEventListener('popstate', historyHandler)
    return () => {
      document.removeEventListener('keydown', keyHandler)
      document.removeEventListener('pointerdown', outsideHandler)
      window.removeEventListener('popstate', historyHandler)
    }
  }, [inputRef])

  function choose(word: string) {
    setShowSuggestions(false)
    setActiveIndex(0)
    inputRef.current?.blur()
    onChoose(word)
  }

  return (
    <form
      className="search-root"
      role="search"
      ref={root}
      onSubmit={(event) => {
        event.preventDefault()
        choose(suggestions[activeIndex] ?? query)
      }}
    >
      <label className="sr-only" htmlFor="lookup-word">
        {mode === 'ja' ? 'Nhập từ tiếng Nhật' : 'Nhập từ tiếng Anh'}
      </label>
      <div className={'search-field ' + (showSuggestions ? 'search-field-active' : '')}>
        <Search size={21} strokeWidth={1.9} aria-hidden="true" />
        <input
          ref={inputRef}
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
            setActiveIndex(0)
            setShowSuggestions(true)
            onQueryChange(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && suggestions.length) {
              event.preventDefault()
              setActiveIndex((previous) => (previous + 1) % suggestions.length)
            } else if (event.key === 'ArrowUp' && suggestions.length) {
              event.preventDefault()
              setActiveIndex((previous) => (previous + suggestions.length - 1) % suggestions.length)
            } else if (event.key === 'Tab') {
              setShowSuggestions(false)
            }
          }}
        />
        {query && (
          <button
            className="clear-search"
            type="button"
            aria-label="Xóa từ đã nhập"
            onClick={() => { onQueryChange(''); setActiveIndex(0); inputRef.current?.focus() }}
          >
            <X size={18} strokeWidth={1.9} />
          </button>
        )}
        {!coarsePointer && <span className="keyboard-hint" aria-hidden="true">{shortcutLabel}</span>}
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
              tabIndex={-1}
              aria-selected={index === activeIndex}
              className={'suggestion ' + (index === activeIndex ? 'suggestion-active' : '')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(word)}
            >
              <span lang={mode === 'ja' ? 'ja' : 'en'}>{word}</span>
              <span className="suggestion-arrow" aria-hidden="true">↗</span>
            </button>
          )) : (
            <p className="suggestion-message">{emptyMessage}</p>
          )}
        </div>
      )}
    </form>
  )
}

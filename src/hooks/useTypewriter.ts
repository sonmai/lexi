import { useEffect, useState } from 'react'

const TYPE_MS = 110
const DELETE_MS = 45
const HOLD_MS = 1600
const GAP_MS = 400

/** Types each word out, holds it, deletes it, then moves on to the next; null while inactive. */
export function useTypewriter(words: readonly string[] | undefined, active: boolean): string | null {
  const [text, setText] = useState('')

  useEffect(() => {
    if (!active || !words?.length) return
    let word = 0
    let length = 0
    let deleting = false
    let timer = 0
    const step = () => {
      // Code points, so kana and kanji are typed one character at a time.
      const chars = Array.from(words[word])
      if (!deleting) {
        length += 1
        deleting = length === chars.length
        timer = window.setTimeout(step, deleting ? HOLD_MS : TYPE_MS)
      } else {
        length -= 1
        if (length === 0) {
          deleting = false
          word = (word + 1) % words.length
        }
        timer = window.setTimeout(step, length === 0 ? GAP_MS : DELETE_MS)
      }
      setText(chars.slice(0, length).join(''))
    }
    setText('')
    timer = window.setTimeout(step, GAP_MS)
    return () => window.clearTimeout(timer)
  }, [words, active])

  return active && words?.length ? text : null
}

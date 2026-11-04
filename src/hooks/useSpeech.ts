import { useCallback, useState } from 'react'

export interface Speaking {
  text: string
  lang: string
  utterance: SpeechSynthesisUtterance
}

export function useSpeech() {
  const [canSpeak] = useState(() => 'speechSynthesis' in window)
  const [speaking, setSpeaking] = useState<Speaking | null>(null)

  const speak = useCallback((text: string, lang: string) => {
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
    // cancel() ends the previous utterance asynchronously, after this one has started.
    const finish = () => setSpeaking((current) => (current?.utterance === speech ? null : current))
    speech.onend = finish
    speech.onerror = finish
    setSpeaking({ text, lang, utterance: speech })
    window.speechSynthesis.speak(speech)
  }, [canSpeak])

  return { canSpeak, speak, speaking }
}

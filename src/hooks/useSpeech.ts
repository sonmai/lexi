import { useCallback, useState } from 'react'

export function useSpeech() {
  const [canSpeak] = useState(() => 'speechSynthesis' in window)

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
    window.speechSynthesis.speak(speech)
  }, [canSpeak])

  return { canSpeak, speak }
}

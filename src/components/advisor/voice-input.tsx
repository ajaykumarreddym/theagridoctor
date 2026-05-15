'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'

type Props = {
  onTranscript: (text: string) => void
  onInterim?: (text: string) => void
  onStart?: () => void
  language?: string
  disabled?: boolean
  className?: string
}

// Map common user preferences → BCP-47 codes used by Web Speech API
const LANG_MAP: Record<string, string> = {
  English: 'en-IN',
  Hindi: 'hi-IN',
  Telugu: 'te-IN',
  Tamil: 'ta-IN',
  Kannada: 'kn-IN',
  Malayalam: 'ml-IN',
  Marathi: 'mr-IN',
  Gujarati: 'gu-IN',
  Bengali: 'bn-IN',
  Punjabi: 'pa-IN',
  Urdu: 'ur-IN',
  Odia: 'or-IN',
}

// Minimal subset of the Web Speech API we use
interface SpeechRecognitionAlt {
  start: () => void
  stop: () => void
  abort: () => void
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: Event) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}
interface SpeechRecognitionEvent {
  resultIndex: number
  results: ArrayLike<{
    0: { transcript: string; confidence: number }
    isFinal: boolean
    length: number
  }>
}

export function VoiceInput({ onTranscript, onInterim, onStart, language, disabled, className }: Props) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recogRef = useRef<SpeechRecognitionAlt | null>(null)
  const finalBufRef = useRef<string>('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionAlt
      webkitSpeechRecognition?: new () => SpeechRecognitionAlt
    }
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    setSupported(Boolean(Ctor))
  }, [])

  const stop = useCallback(() => {
    try { recogRef.current?.stop() } catch { /* ignore */ }
  }, [])

  const start = useCallback(() => {
    if (!supported || disabled) return
    setError(null)
    finalBufRef.current = ''

    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionAlt
      webkitSpeechRecognition?: new () => SpeechRecognitionAlt
    }
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!Ctor) return
    const r = new Ctor()
    r.continuous = true
    r.interimResults = true
    r.lang = (language && LANG_MAP[language]) || 'en-IN'

    r.onstart = () => { setListening(true); onStart?.() }
    r.onend = () => {
      setListening(false)
      const finalText = finalBufRef.current.trim()
      if (finalText) onTranscript(finalText)
    }
    r.onerror = (e: Event) => {
      const err = e as unknown as { error?: string }
      setError(err.error ?? 'mic error')
      setListening(false)
    }
    r.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        const txt = res[0].transcript
        if (res.isFinal) finalBufRef.current += (finalBufRef.current ? ' ' : '') + txt
        else interim += txt
      }
      if (onInterim) onInterim((finalBufRef.current + ' ' + interim).trim())
    }

    recogRef.current = r
    try {
      r.start()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to start')
      setListening(false)
    }
  }, [supported, disabled, language, onTranscript, onInterim, onStart])

  useEffect(() => () => { try { recogRef.current?.abort() } catch {/* */} }, [])

  if (supported === false) return null

  const toggle = () => (listening ? stop() : start())

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || supported === null}
      title={listening ? 'Stop recording' : 'Speak your question'}
      aria-label={listening ? 'Stop recording' : 'Start voice input'}
      className={
        className ??
        `h-12 w-12 rounded-xl flex-shrink-0 flex items-center justify-center transition-colors ${
          listening
            ? 'bg-rose-500 hover:bg-rose-600 text-white ring-2 ring-rose-200 animate-pulse'
            : 'bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`
      }
    >
      {supported === null ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : listening ? (
        <MicOff className="w-4 h-4" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
      {error && (
        <span className="sr-only">{error}</span>
      )}
    </button>
  )
}

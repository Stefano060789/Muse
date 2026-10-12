import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_NARRATION_PREFERENCES, legacyNarrationStyle, narrationChunks, NARRATION_PREFERENCES_KEY, NARRATION_PRESETS, NARRATION_STYLES,
  normalizeNarrationLanguagePreference, parseNarrationPreferences, selectNarrationVoice, serializeNarrationPreferences, validateNarrationLanguage,
  voiceKey, voiceKeyName, type NarrationMetadata, type NarrationPreferences, type NarrationStyle
} from './narration'

export type NarrationStatus = 'idle' | 'loading' | 'speaking' | 'paused'

const STORAGE_READ_NOTICE = 'Saved narration preferences could not be read because browser storage is unavailable or blocked. Defaults are in use and new choices may not be remembered.'
const STORAGE_INVALID_NOTICE = 'Some saved narration preferences were invalid and were ignored. Defaults are used for those settings; saved data only changes when you pick a new setting.'
const STORAGE_WRITE_NOTICE = 'Your narration choice applies now, but it could not be remembered because browser storage is unavailable, blocked or full.'

function readStoredPreferences(): { preferences: NarrationPreferences; notice: string } {
  let raw: string | null
  try { raw = window.localStorage.getItem(NARRATION_PREFERENCES_KEY) } catch {
    return { preferences: { ...DEFAULT_NARRATION_PREFERENCES }, notice: STORAGE_READ_NOTICE }
  }
  const parsed = parseNarrationPreferences(raw)
  return { preferences: parsed.preferences, notice: parsed.invalid ? STORAGE_INVALID_NOTICE : '' }
}

export function useNarration(metadata: NarrationMetadata = {}, mood?: string) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [supported, setSupported] = useState<boolean | null>(null)
  const [styleOverride, setStyleOverride] = useState<NarrationStyle | 'auto'>('auto')
  const [languageOverride, setLanguageOverride] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('')
  const [status, setStatus] = useState<NarrationStatus>('idle')
  const [activeText, setActiveText] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preferenceNotice, setPreferenceNotice] = useState('')
  const active = useRef(0)
  const mounted = useRef(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const url = useRef('')
  const request = useRef<AbortController | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerAction = useRef<(() => void) | null>(null)
  const timerDeadline = useRef(0)
  const timerRemaining = useRef(0)
  const utterance = useRef<SpeechSynthesisUtterance | null>(null)
  const mode = useRef<'browser' | 'audio' | null>(null)
  const paused = useRef(false)
  const pendingAdvance = useRef<(() => void) | null>(null)
  const provider = process.env.NEXT_PUBLIC_NARRATION_PROVIDER === 'elevenlabs' ? 'elevenlabs' : 'browser'
  const aiStyle = NARRATION_STYLES.includes(metadata.narrationStyle as NarrationStyle) ? metadata.narrationStyle : undefined
  const style = styleOverride === 'auto' ? aiStyle || legacyNarrationStyle(mood) : styleOverride
  let inferredLanguage = 'en-US'
  try { if (metadata.narrationLanguage) inferredLanguage = validateNarrationLanguage(metadata.narrationLanguage) } catch { /* Legacy metadata is not trusted. */ }
  const language = languageOverride || inferredLanguage
  const voice = selectNarrationVoice(voices, language, style, selectedVoice)

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    timerAction.current = null
  }
  const armTimer = (ms: number, action: () => void) => {
    clearTimer()
    timerAction.current = action
    timerDeadline.current = Date.now() + ms
    timer.current = setTimeout(() => { timer.current = null; timerAction.current = null; action() }, ms)
  }
  // Paused playback keeps its pending timeout action but stops the clock until resume.
  const suspendTimer = () => {
    if (!timer.current) return
    clearTimeout(timer.current)
    timer.current = null
    timerRemaining.current = Math.max(0, timerDeadline.current - Date.now())
  }
  const restoreTimer = () => {
    const action = timerAction.current
    if (!action || timer.current) return
    armTimer(Math.max(1000, timerRemaining.current), action)
  }

  const release = useCallback(() => {
    active.current += 1
    request.current?.abort()
    request.current = null
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    timerAction.current = null
    const wasPaused = paused.current
    paused.current = false
    pendingAdvance.current = null
    mode.current = null
    if (utterance.current) {
      utterance.current.onend = null
      utterance.current.onerror = null
      utterance.current.onstart = null
      utterance.current = null
    }
    if (audio.current) {
      audio.current.onended = null
      audio.current.onerror = null
      audio.current.pause()
      audio.current = null
    }
    if (url.current) URL.revokeObjectURL(url.current)
    url.current = ''
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (synth) {
      try {
        synth.cancel()
        // Some engines keep the global paused flag across cancel(); clear it so later speech is not silently held.
        if ((wasPaused || synth.paused) && typeof synth.resume === 'function') synth.resume()
      } catch { /* Cancellation must never throw into UI handlers. */ }
    }
  }, [])
  const stop = useCallback(() => {
    release()
    if (mounted.current) { setStatus('idle'); setActiveText('') }
  }, [release])
  const fail = (message = '') => {
    release()
    if (!mounted.current) return
    setStatus('idle')
    setActiveText('')
    if (message) setError(message)
  }

  useEffect(() => {
    mounted.current = true
    const stored = readStoredPreferences()
    setStyleOverride(stored.preferences.style)
    setLanguageOverride(stored.preferences.language)
    setSelectedVoice(stored.preferences.voice)
    setPreferenceNotice(stored.notice)
    const synth = window.speechSynthesis
    setSupported(Boolean(synth && typeof SpeechSynthesisUtterance !== 'undefined'))
    const refresh = () => setVoices(synth?.getVoices() || [])
    refresh()
    synth?.addEventListener('voiceschanged', refresh)
    // Some browsers populate voices without delivering voiceschanged reliably.
    const poll = setInterval(refresh, 1500)
    return () => {
      mounted.current = false
      clearInterval(poll)
      synth?.removeEventListener('voiceschanged', refresh)
      release()
    }
  }, [release])

  useEffect(() => { stop() }, [style, language, selectedVoice, metadata.narrationStyle, metadata.narrationLanguage, stop])

  const persist = (next: NarrationPreferences) => {
    try {
      window.localStorage.setItem(NARRATION_PREFERENCES_KEY, serializeNarrationPreferences(next))
      setPreferenceNotice('')
    } catch { setPreferenceNotice(STORAGE_WRITE_NOTICE) }
  }

  const speak = async (text: string) => {
    stop()
    setError('')
    setNotice('')
    if (!text.trim()) { setError('There is no text to narrate.'); return }
    const id = active.current
    setActiveText(text)
    const valid = () => mounted.current && active.current === id
    const finish = (message = '') => { if (valid()) fail(message) }
    const browser = () => {
      if (!valid()) return
      if (!supported) { finish('Browser narration is not supported here. You can still read the story.'); return }
      if (!voice) {
        finish(voices.length ? `No browser voice is available for ${language}. Choose an available language or add a voice in your OS settings.` : 'No browser voices are available yet. Wait for voices to load, then try again, or check your OS speech settings.')
        return
      }
      const chunks = narrationChunks(text)
      let index = 0
      const next = () => {
        if (!valid()) return
        clearTimer()
        // Never advance while paused: the next chunk waits for an explicit resume.
        if (paused.current) { pendingAdvance.current = next; return }
        pendingAdvance.current = null
        if (index >= chunks.length) { finish(); return }
        const current = new SpeechSynthesisUtterance(chunks[index++])
        utterance.current = current
        current.voice = voice
        current.lang = voice.lang
        current.rate = NARRATION_PRESETS[style].rate
        current.pitch = NARRATION_PRESETS[style].pitch
        current.onstart = () => { if (valid() && !paused.current) setStatus('speaking') }
        current.onend = () => { if (valid() && utterance.current === current) next() }
        current.onerror = () => finish('Browser narration failed. You can retry or keep reading.')
        armTimer(45000, () => finish('Browser narration did not finish. Please retry or select another voice.'))
        try { window.speechSynthesis.speak(current) } catch { finish('Could not start browser narration.') }
      }
      mode.current = 'browser'
      setStatus('speaking')
      next()
    }
    if (provider === 'browser') { browser(); return }
    setStatus('loading')
    const controller = new AbortController()
    request.current = controller
    armTimer(20000, () => controller.abort())
    try {
      const response = await fetch('/api/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, narrationStyle: style, narrationLanguage: language }), signal: controller.signal
      })
      if (!response.ok) throw new Error('Provider unavailable')
      const blob = await response.blob()
      if (!valid()) return
      clearTimer()
      request.current = null
      url.current = URL.createObjectURL(blob)
      const player = new Audio(url.current)
      audio.current = player
      player.onended = () => finish()
      player.onerror = () => finish('Provider audio playback failed. Try browser mode or keep reading.')
      armTimer(20000, () => finish('Provider audio did not start. Please retry or use browser narration.'))
      await player.play()
      if (valid()) {
        armTimer(Math.max(60000, text.length * 120), () => finish('Provider narration did not finish. Please retry.'))
        mode.current = 'audio'
        setStatus('speaking')
      }
    } catch {
      if (!valid()) return
      clearTimer()
      request.current = null
      audio.current?.pause()
      audio.current = null
      if (url.current) URL.revokeObjectURL(url.current)
      url.current = ''
      setNotice('ElevenLabs narration is unavailable; falling back to your selected browser voice.')
      browser()
    }
  }

  const browserCanPause = typeof window !== 'undefined' && typeof window.speechSynthesis?.pause === 'function' && typeof window.speechSynthesis?.resume === 'function'
  const canPause = status === 'speaking' && (mode.current === 'audio' || (mode.current === 'browser' && browserCanPause))

  const pause = () => {
    if (paused.current || !mode.current) return
    try {
      if (mode.current === 'audio') {
        if (!audio.current) return
        audio.current.pause()
      } else {
        if (!browserCanPause) return
        window.speechSynthesis.pause()
      }
    } catch { setError('Narration could not be paused. You can stop it instead.'); return }
    paused.current = true
    suspendTimer()
    setStatus('paused')
  }

  const resume = () => {
    if (!paused.current || !mode.current) return
    const id = active.current
    const finishIfCurrent = (message: string) => { if (mounted.current && active.current === id) fail(message) }
    paused.current = false
    setStatus('speaking')
    if (mode.current === 'audio') {
      const player = audio.current
      if (!player) { finishIfCurrent('Provider audio is no longer available. Stop and listen again.'); return }
      restoreTimer()
      try { void Promise.resolve(player.play()).catch(() => finishIfCurrent('Provider audio could not resume. Stop and listen again.')) } catch {
        finishIfCurrent('Provider audio could not resume. Stop and listen again.')
      }
      return
    }
    try { window.speechSynthesis.resume() } catch { finishIfCurrent('Browser narration could not resume. Stop and listen again.'); return }
    const advance = pendingAdvance.current
    pendingAdvance.current = null
    if (advance) advance()
    else restoreTimer()
  }

  const setStyle = (value: NarrationStyle | 'auto') => {
    if (value !== 'auto' && !NARRATION_STYLES.includes(value)) return
    stop()
    setStyleOverride(value)
    persist({ style: value, language: languageOverride, voice: selectedVoice })
  }
  const setLanguage = (value: string) => {
    stop()
    let normalized = ''
    try { normalized = normalizeNarrationLanguagePreference(value) } catch {
      setLanguageOverride(value)
      setSelectedVoice('')
      setPreferenceNotice(`The language "${value}" applies now but cannot be remembered because it is not a valid language tag.`)
      return
    }
    setLanguageOverride(normalized)
    setSelectedVoice('')
    persist({ style: styleOverride, language: normalized, voice: '' })
  }
  const setVoice = (value: string) => {
    stop()
    setSelectedVoice(value)
    persist({ style: styleOverride, language: languageOverride, voice: value })
  }

  let voiceNotice = ''
  if (selectedVoice && voices.length) {
    const remembered = voices.find((item) => voiceKey(item) === selectedVoice)
    const name = voiceKeyName(selectedVoice)
    const fallback = voice ? `${voice.name} (${voice.lang})` : `no voice, because none is available for ${language}`
    if (!remembered) voiceNotice = `Your chosen browser voice "${name}" is not available in this browser or device. Using ${fallback} instead; your choice stays saved for when it is available.`
    else if (remembered !== voice) voiceNotice = `Your chosen browser voice "${name}" (${remembered.lang}) does not match ${language}. Using ${fallback} instead.`
  }

  return {
    voices, supported, styleOverride, languageOverride, selectedVoice, style, language, voice,
    status, speaking: status === 'speaking', loading: status === 'loading', paused: status === 'paused', busy: status !== 'idle',
    activeText, canPause, error, notice, preferenceNotice, voiceNotice, provider,
    speak, stop, pause, resume, setStyle, setLanguage, setVoice,
    source: styleOverride !== 'auto' ? 'Manual style' : aiStyle ? 'AI-selected style' : `Legacy ${mood ? 'mood' : 'story'} fallback (not AI-selected)`
  }
}
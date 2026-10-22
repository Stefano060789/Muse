import { useEffect, useRef, useState } from 'react'

type RecognitionEvent = Event & { results: SpeechRecognitionResultList }
type Recognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onend: (() => void) | null
  onaudiostart: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  onresult: ((event: RecognitionEvent) => void) | null
  abort: () => void
  start: () => void
  stop: () => void
}
type RecognitionWindow = Window & {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}

export function useStoryInteraction(beforeDictate?: () => void, language = 'en-US') {
  const [recordingTarget, setRecordingTarget] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const recognitionRef = useRef<Recognition | null>(null)
  const stopRequestedRef = useRef<Recognition | null>(null)
  const targetRef = useRef('')
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelRecording = () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    stopRequestedRef.current = null
    targetRef.current = ''
    if (finishTimer.current) clearTimeout(finishTimer.current)
    finishTimer.current = null
    setRecordingTarget('')
    setReady(false)
    if (recognition) {
      try { recognition.abort() } catch {
        setError('Could not close microphone input. Disable microphone access for this page before continuing.')
      }
    }
  }

  const stopRecording = (target?: string) => {
    if (target && targetRef.current !== target) return
    const recognition = recognitionRef.current
    if (!recognition || stopRequestedRef.current === recognition) return
    stopRequestedRef.current = recognition
    setRecordingTarget('')
    setReady(false)
    finishTimer.current = setTimeout(() => {
      if (recognitionRef.current === recognition) cancelRecording()
    }, 1500)
    try { recognition.stop() } catch {
      cancelRecording()
    }
  }

  useEffect(() => () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    stopRequestedRef.current = null
    if (finishTimer.current) clearTimeout(finishTimer.current)
    recognition?.abort()
  }, [])

  const dictate = (target: string, onTranscript: (value: string) => void, singlePhrase = false) => {
    cancelRecording()
    beforeDictate?.()
    const Constructor = (window as RecognitionWindow).SpeechRecognition || (window as RecognitionWindow).webkitSpeechRecognition
    if (!Constructor) {
      setError('Voice input is not supported in this browser. You can type instead, or try Chrome or Edge.')
      return
    }
    setError('')
    const recognition = new Constructor()
    recognition.continuous = !singlePhrase
    recognition.interimResults = true
    recognition.lang = language
    recognition.onaudiostart = () => {
      if (recognitionRef.current === recognition && stopRequestedRef.current !== recognition) setReady(true)
    }
    let receivedText = false
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0].transcript
      if (transcript.trim()) {
        receivedText = true
        onTranscript(transcript.trim())
      }
    }
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return
      recognitionRef.current = null
      const stoppedIntentionally = stopRequestedRef.current === recognition
      stopRequestedRef.current = null
      targetRef.current = ''
      if (finishTimer.current) clearTimeout(finishTimer.current)
      finishTimer.current = null
      setRecordingTarget('')
      setReady(false)
      if (stoppedIntentionally && event.error === 'aborted') return
      const errors: Record<string, string> = {
        network: 'The browser speech-recognition service could not connect. In the VS Code browser, open this same address in regular Microsoft Edge or Google Chrome and try again. Check your internet connection; you can also type instead.',
        'not-allowed': 'Microphone access was denied. Allow it for this site in your browser permissions and device privacy settings, reload, then try again—or type instead.',
        'service-not-allowed': 'This browser does not allow its speech-recognition service. Open this page in regular Microsoft Edge or Google Chrome, or type instead.',
        'audio-capture': 'No working microphone was available. Check the selected microphone and Windows microphone settings, or type instead.',
        'no-speech': 'No speech was detected. Use the microphone input test below, check the dictation language, then wait for "Listening - speak now" before speaking. You can also type instead.',
        'language-not-supported': 'The selected dictation language is unavailable in this browser. Select another language, try Edge or Chrome, or type instead.',
        aborted: 'Voice input was interrupted. Try again or type instead.'
      }
      setError(errors[event.error] || 'Voice recording failed. Please check microphone access or type your text.')
    }
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return
      recognitionRef.current = null
      const stoppedIntentionally = stopRequestedRef.current === recognition
      stopRequestedRef.current = null
      targetRef.current = ''
      if (finishTimer.current) clearTimeout(finishTimer.current)
      finishTimer.current = null
      setRecordingTarget('')
      setReady(false)
      if (!receivedText && !stoppedIntentionally) setError('No words were received. Try again, check your microphone, or type instead.')
    }
    recognitionRef.current = recognition
    targetRef.current = target
    stopRequestedRef.current = null
    try {
      recognition.start()
      setRecordingTarget(target)
    } catch {
      recognitionRef.current = null
      targetRef.current = ''
      setError('Could not start voice recording. Please type your text or try again.')
    }
  }

  return { recordingTarget, ready, error, dictate, stopRecording, cancelRecording }
}

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

  const stopRecording = () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) {
      try { recognition.abort() } catch {
        try { recognition.stop() } catch {
          setError('Could not stop voice recording. Close this page or disable microphone access to end dictation.')
        }
      }
    }
    setRecordingTarget('')
    setReady(false)
  }

  useEffect(() => () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    recognition?.abort()
  }, [])

  const dictate = (target: string, onTranscript: (value: string) => void, singlePhrase = false) => {
    const wasRecording = recognitionRef.current !== null && recordingTarget === target
    stopRecording()
    if (wasRecording) return
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
      if (recognitionRef.current === recognition) setReady(true)
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
      setRecordingTarget('')
      setReady(false)
      const errors: Record<string, string> = {
        network: 'The browser speech-recognition service could not connect. In the VS Code browser, open this same address in regular Microsoft Edge or Google Chrome and try again. Check your internet connection; you can also type instead.',
        'not-allowed': 'Microphone access was denied. Allow microphone access for this site in your browser and Windows privacy settings, or type instead.',
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
      setRecordingTarget('')
      setReady(false)
      if (!receivedText) setError('No words were received. Try again, check your microphone, or type instead.')
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setRecordingTarget(target)
    } catch {
      recognitionRef.current = null
      setError('Could not start voice recording. Please type your text or try again.')
    }
  }

  return { recordingTarget, ready, error, dictate, stopRecording }
}

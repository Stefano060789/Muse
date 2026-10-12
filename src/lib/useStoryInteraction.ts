import { useEffect, useRef, useState } from 'react'

type RecognitionEvent = Event & { results: SpeechRecognitionResultList }
type Recognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: ((event: RecognitionEvent) => void) | null
  start: () => void
  stop: () => void
}
type RecognitionWindow = Window & {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}

export function useStoryInteraction(beforeDictate?: () => void) {
  const [recordingTarget, setRecordingTarget] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef<Recognition | null>(null)

  const stopRecording = () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    recognition?.stop()
    setRecordingTarget('')
  }

  useEffect(() => () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    recognition?.stop()
  }, [])

  const dictate = (target: string, onTranscript: (value: string) => void) => {
    const wasRecording = recordingTarget === target
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
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0].transcript
      onTranscript(transcript.trim())
    }
    recognition.onerror = () => {
      if (recognitionRef.current !== recognition) return
      recognitionRef.current = null
      setRecordingTarget('')
      setError('Voice recording failed. Please check microphone access or type your text.')
    }
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return
      recognitionRef.current = null
      setRecordingTarget('')
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

  return { recordingTarget, error, dictate, stopRecording }
}

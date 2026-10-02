import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { answerCurrentBeat, createStoryArc, loadStoryArc, saveStoryArc, STORY_TEMPLATES, type StoryArc } from '../lib/story'

type SpeechRecognitionResultEvent = Event & {
  resultIndex: number
  results: SpeechRecognitionResultList
}

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onend: (() => void) | null
  onerror: ((event: Event) => void) | null
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

const PROFILE_STORAGE_KEY = 'muse-profile'

export default function CouplesStoryPage() {
  const [story, setStory] = useState<StoryArc | null>(null)
  const [templateKey, setTemplateKey] = useState(STORY_TEMPLATES[0].key)
  const [partnerA, setPartnerA] = useState('You')
  const [partnerB, setPartnerB] = useState('Your partner')
  const [response, setResponse] = useState('')
  const [about, setAbout] = useState('')
  const [profileKeypoints, setProfileKeypoints] = useState<string[]>([])
  const [error, setError] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isProfileRecording, setIsProfileRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const savedStory = loadStoryArc()
    if (savedStory) {
      setStory(savedStory)
      setTemplateKey(savedStory.templateKey)
      setPartnerA(savedStory.partnerA)
      setPartnerB(savedStory.partnerB)
    }

    const savedProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY)
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile) as { about?: string; keypoints?: string[] }
        setAbout(profile.about || '')
        setProfileKeypoints(profile.keypoints || [])
      } catch {
        window.localStorage.removeItem(PROFILE_STORAGE_KEY)
      }
    }

    return () => {
      recognitionRef.current?.stop()
      audioRef.current?.pause()
      if (audioRef.current) URL.revokeObjectURL(audioRef.current.src)
    }
  }, [])

  const currentBeat = useMemo(() => {
    if (!story) return null
    return story.beats[story.currentBeat]
  }, [story])

  const startStory = async () => {
    setError('')
    if (about.trim()) {
      const saved = await saveProfile()
      if (!saved) return
    }

    const nextStory = createStoryArc(templateKey, partnerA, partnerB, profileKeypoints)
    saveStoryArc(nextStory)
    setStory(nextStory)
    setResponse('')
  }

  const saveProfile = async () => {
    if (!about.trim()) {
      setError('Tell Muse something about yourself before saving your profile.')
      return false
    }

    const profile = {
      about: about.trim(),
      keypoints: about
        .split(/[.!?]+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean)
        .slice(0, 8),
      updatedAt: new Date().toISOString()
    }
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
    setProfileKeypoints(profile.keypoints || [])
    return true
  }

  const handleAnswer = async () => {
    if (!story || !response.trim()) return
    setError('')

    const nextStory = answerCurrentBeat(story, response)
    saveStoryArc(nextStory)
    setStory(nextStory)
    setResponse('')
  }

  const speakText = async (text: string) => {
    setError('')
    setIsLoadingAudio(true)

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })

      if (!res.ok) {
        if (res.status === 503 && 'speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.onstart = () => setIsSpeaking(true)
          utterance.onend = () => setIsSpeaking(false)
          utterance.onerror = () => {
            setIsSpeaking(false)
            setError('Audio playback failed.')
          }
          window.speechSynthesis.cancel()
          window.speechSynthesis.speak(utterance)
          return
        }
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Could not generate audio.')
      }

      const audioUrl = URL.createObjectURL(await res.blob())
      audioRef.current?.pause()
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src)

      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onplay = () => setIsSpeaking(true)
      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
      }
      audio.onerror = () => {
        setIsSpeaking(false)
        setError('Audio playback failed.')
        URL.revokeObjectURL(audioUrl)
      }
      await audio.play()
    } catch (audioError) {
      setError(audioError instanceof Error ? audioError.message : 'Could not play audio.')
    } finally {
      setIsLoadingAudio(false)
    }
  }

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop()
      return
    }

    const recognitionConstructor = (window as SpeechRecognitionWindow).SpeechRecognition
      || (window as SpeechRecognitionWindow).webkitSpeechRecognition

    if (!recognitionConstructor) {
      setError('Voice input is not supported in this browser. Try the latest Chrome or Edge.')
      return
    }

    setError('')
    const recognition = new recognitionConstructor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      let transcript = ''
      for (let index = event.resultIndex || 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript
      }
      setResponse(transcript.trim())
    }
    recognition.onerror = () => {
      setIsRecording(false)
      setError('Could not understand the recording. Please try again.')
    }
    recognition.onend = () => {
      setIsRecording(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setIsRecording(true)
    recognition.start()
  }

  const toggleProfileRecording = () => {
    if (isProfileRecording) {
      recognitionRef.current?.stop()
      return
    }

    const recognitionConstructor = (window as SpeechRecognitionWindow).SpeechRecognition
      || (window as SpeechRecognitionWindow).webkitSpeechRecognition

    if (!recognitionConstructor) {
      setError('Voice input is not supported in this browser. Try the latest Chrome or Edge.')
      return
    }

    setError('')
    const recognition = new recognitionConstructor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      let transcript = ''
      for (let index = event.resultIndex || 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript
      }
      setAbout((current) => `${current}${current ? ' ' : ''}${transcript.trim()}`.trim())
    }
    recognition.onerror = () => {
      setIsProfileRecording(false)
      setError('Could not understand the recording. Please try again.')
    }
    recognition.onend = () => {
      setIsProfileRecording(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setIsProfileRecording(true)
    recognition.start()
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem', fontFamily: 'Georgia, serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '2.2rem', margin: 0 }}>Muse — Shared Story Mode</h1>
        <Link href="/" style={{ color: '#2d2926', textDecoration: 'none', fontWeight: 600 }}>Back to home</Link>
      </header>

      {error ? <p style={{ color: '#a14329', marginBottom: '1rem' }}>{error}</p> : null}

      {!story ? (
        <section style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ border: '1px solid #d9cfc5', borderRadius: 16, padding: '1.5rem', background: '#fffaf6' }}>
            <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.75rem', opacity: 0.7, marginTop: 0 }}>
              Your Muse profile
            </p>
            <h2 style={{ margin: '0.25rem 0 0.75rem' }}>Tell Muse about you</h2>
            <p style={{ lineHeight: 1.7, marginTop: 0 }}>
              Share the experiences, people, places, hopes, or needs that should shape your stories. Muse keeps the key points locally and uses them to personalize new story arcs.
            </p>
            <textarea
              value={about}
              onChange={(event) => setAbout(event.target.value)}
              rows={5}
              placeholder="For example: I am rebuilding my routine after moving to a new city. I feel most connected through small rituals, long walks, and honest conversations."
              style={{ display: 'block', width: '100%', padding: '0.9rem', fontSize: '1rem', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <button onClick={toggleProfileRecording} style={{ padding: '0.8rem 1rem', cursor: 'pointer', background: isProfileRecording ? '#a14329' : undefined, color: isProfileRecording ? '#fffaf6' : undefined }}>
                {isProfileRecording ? 'Stop telling Muse' : 'Tell Muse by voice'}
              </button>
              <button onClick={saveProfile} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>
                Save profile
              </button>
            </div>
            {isProfileRecording ? <p style={{ marginBottom: 0, fontSize: '0.9rem', opacity: 0.7 }}>Listening… speak naturally, then stop recording.</p> : null}
            {profileKeypoints.length > 0 ? (
              <div style={{ marginTop: '1rem' }}>
                <strong>Key points Muse will remember:</strong>
                <ul style={{ marginBottom: 0, lineHeight: 1.7 }}>
                  {profileKeypoints.map((keypoint) => <li key={keypoint}>{keypoint}</li>)}
                </ul>
              </div>
            ) : null}
          </div>

          <label>
            Story template
            <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.8rem' }}>
              {STORY_TEMPLATES.map((template) => (
                <option key={template.key} value={template.key}>{template.title}</option>
              ))}
            </select>
          </label>

          <label>
            Partner A name
            <input value={partnerA} onChange={(e) => setPartnerA(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.8rem' }} />
          </label>

          <label>
            Partner B name
            <input value={partnerB} onChange={(e) => setPartnerB(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.8rem' }} />
          </label>

          <button onClick={startStory} style={{ padding: '0.9rem 1.2rem', fontSize: '1rem', cursor: 'pointer' }}>
            Start the story
          </button>
        </section>
      ) : (
        <section style={{ display: 'grid', gap: '1.25rem' }}>
          <div style={{ border: '1px solid #d9cfc5', borderRadius: 16, padding: '1.5rem', background: '#fffaf6' }}>
            <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.75rem', opacity: 0.7 }}>
              {story.partnerA} + {story.partnerB}
            </p>
            <h2 style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>{story.title}</h2>
            <p style={{ margin: 0, lineHeight: 1.7 }}>{story.description}</p>
          </div>

          <div style={{ border: '1px solid #d9cfc5', borderRadius: 16, padding: '1.5rem', background: '#f7f3ed' }}>
            <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.7rem', opacity: 0.7 }}>
              Beat {currentBeat?.number ?? story.currentBeat + 1}
            </p>
            <h3 style={{ marginTop: '0.25rem', marginBottom: '0.75rem' }}>{currentBeat?.title}</h3>
            <p style={{ lineHeight: 1.8, marginBottom: '1rem' }}>{currentBeat?.body}</p>
            <p style={{ fontStyle: 'italic', margin: 0 }}><strong>Clue:</strong> {currentBeat?.clue}</p>
            <button
              onClick={() => speakText(`${currentBeat?.body || ''} ${currentBeat?.clue || ''}`)}
              disabled={isLoadingAudio || isSpeaking}
              style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', cursor: isLoadingAudio || isSpeaking ? 'wait' : 'pointer' }}
            >
              {isLoadingAudio ? 'Preparing audio…' : isSpeaking ? 'Muse is speaking…' : 'Listen to this beat'}
            </button>
            {isSpeaking ? (
              <button
                onClick={() => {
                  audioRef.current?.pause()
                  window.speechSynthesis.cancel()
                  setIsSpeaking(false)
                }}
                style={{ marginTop: '1.25rem', marginLeft: '0.5rem', padding: '0.75rem 1rem', cursor: 'pointer' }}
              >
                Stop
              </button>
            ) : null}
          </div>

          <div style={{ border: '1px solid #d9cfc5', borderRadius: 16, padding: '1.5rem' }}>
            <label>
              Your answer / discovery
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={5}
                style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.9rem', fontSize: '1rem', resize: 'vertical' }}
              />
            </label>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <button
                onClick={toggleRecording}
                style={{ padding: '0.9rem 1.2rem', cursor: 'pointer', background: isRecording ? '#a14329' : undefined, color: isRecording ? '#fffaf6' : undefined }}
              >
                {isRecording ? 'Stop recording' : 'Answer by voice'}
              </button>
              <button onClick={handleAnswer} style={{ padding: '0.9rem 1.2rem', cursor: 'pointer' }}>
              Save discovery
              </button>
            </div>
            <p style={{ marginBottom: 0, fontSize: '0.9rem', opacity: 0.7 }}>
              {isRecording ? 'Listening… speak your answer, then stop recording.' : 'Your transcript will appear above so you can review it before saving.'}
            </p>
          </div>

          <div style={{ border: '1px solid #d9cfc5', borderRadius: 16, padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0 }}>Your story responses</h3>
            {Object.keys(story.responses).length === 0 ? (
              <p>No discoveries yet.</p>
            ) : (
              <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.8 }}>
                {Object.entries(story.responses).map(([beat, answer]) => (
                  <li key={beat}><strong>Beat {beat}:</strong> {answer}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </main>
  )
}

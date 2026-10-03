import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { loadMuseProfile, saveMuseProfile } from '../lib/profile'

type RecognitionEvent = Event & { resultIndex: number; results: SpeechRecognitionResultList }
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
type RecognitionConstructor = new () => Recognition
type RecognitionWindow = Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }

export default function MyselfPage() {
  const [about, setAbout] = useState('')
  const [keypoints, setKeypoints] = useState<string[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [message, setMessage] = useState('')
  const recognitionRef = useRef<Recognition | null>(null)

  useEffect(() => {
    const profile = loadMuseProfile()
    if (profile) {
      setAbout(profile.about)
      setKeypoints(profile.keypoints)
    }
    return () => recognitionRef.current?.stop()
  }, [])

  const save = () => {
    if (!about.trim()) {
      setMessage('Add a little about yourself first.')
      return
    }
    const profile = saveMuseProfile(about)
    setKeypoints(profile.keypoints)
    setMessage('Saved in this browser. Muse will use these details to personalize your stories.')
  }

  const toggleRecording = () => {
    if (isRecording) {
      const recognition = recognitionRef.current
      recognitionRef.current = null
      recognition?.stop()
      return
    }
    const Constructor = (window as RecognitionWindow).SpeechRecognition || (window as RecognitionWindow).webkitSpeechRecognition
    if (!Constructor) {
      setMessage('Voice input is not supported here. You can type instead.')
      return
    }
    const recognition = new Constructor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0].transcript
      setAbout(transcript.trim())
    }
    recognition.onerror = () => {
      setIsRecording(false)
      recognitionRef.current = null
      setMessage('I could not understand that. Please try again or type instead.')
    }
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        try {
          recognition.start()
        } catch {
          setIsRecording(false)
          recognitionRef.current = null
        }
      }
    }
    recognitionRef.current = recognition
    setMessage('')
    setIsRecording(true)
    recognition.start()
  }

  return (
    <>
      <Head><title>Muse — Myself</title><meta name="description" content="Tell Muse what matters to you so your stories feel personal." /></Head>
      <main style={{ minHeight: '100vh', background: '#f7f3ed', color: '#2d2926', fontFamily: 'Georgia, serif' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '1.5rem' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}>
            <Link href="/" style={{ color: '#2d2926', textDecoration: 'none', fontWeight: 700, letterSpacing: '0.08em' }}>MUSE</Link>
            <Link href="/" style={{ color: '#2d2926', textDecoration: 'none' }}>Home</Link>
          </header>
          <p style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.75rem', opacity: 0.65 }}>Myself</p>
          <h1 style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', lineHeight: 1.05, margin: '0.5rem 0 1rem' }}>Let Muse get to know you.</h1>
          <p style={{ maxWidth: 620, fontSize: '1.15rem', lineHeight: 1.7 }}>Speak or write about what is happening in your life, what you need today, and the people, places, or rituals that matter. Muse keeps the key points in this browser and uses them to make stories feel like yours.</p>
          <section style={{ background: '#fffaf6', border: '1px solid #d9cfc5', borderRadius: 20, padding: '1.5rem', marginTop: '2rem' }}>
            <label style={{ display: 'block', fontWeight: 700 }}>What should Muse remember?
              <textarea value={about} onChange={(event) => setAbout(event.target.value)} rows={8} placeholder="For example: I am feeling restless after moving to a new city. I feel restored by long walks, music, and honest conversations…" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '0.7rem', padding: '1rem', font: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <button onClick={save} style={{ border: 0, borderRadius: 999, background: '#2d2926', color: '#fffaf6', padding: '0.85rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>Save what matters</button>
              <button onClick={toggleRecording} style={{ padding: '0.85rem 1.1rem', cursor: 'pointer', background: isRecording ? '#a14329' : undefined, color: isRecording ? '#fffaf6' : undefined }}>{isRecording ? 'Stop listening' : 'Speak to Muse'}</button>
            </div>
            {message ? <p role="status" style={{ lineHeight: 1.6, marginBottom: 0 }}>{message}</p> : null}
          </section>
          <section style={{ marginTop: '1rem', padding: '1.25rem 1.5rem', border: '1px solid #d9cfc5', borderRadius: 18 }}>
            <h2 style={{ marginTop: 0 }}>Muse is keeping these key points</h2>
            {keypoints.length > 0 ? <ul style={{ lineHeight: 1.8 }}>{keypoints.map((keypoint) => <li key={keypoint}>{keypoint}</li>)}</ul> : <p style={{ marginBottom: 0, opacity: 0.7 }}>Save something about yourself and Muse will keep the important points here.</p>}
          </section>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' }}>
            <Link href="/story" style={{ background: '#2d2926', color: '#fffaf6', borderRadius: 999, padding: '0.85rem 1.2rem', textDecoration: 'none', fontWeight: 700 }}>Create My Story →</Link>
            <Link href="/couples" style={{ color: '#2d2926', border: '1px solid #2d2926', borderRadius: 999, padding: '0.85rem 1.2rem', textDecoration: 'none' }}>Shared story for two</Link>
          </div>
        </div>
      </main>
    </>
  )
}

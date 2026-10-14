import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { forgetMuseProfile, loadMuseProfile, replaceMuseProfileKeypoints, saveMuseProfile, type MuseProfile } from '../lib/profile'

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
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState<string[]>([])
  const recognitionRef = useRef<Recognition | null>(null)

  useEffect(() => {
    try {
      const profile = loadMuseProfile()
      if (profile) applyProfile(profile)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not read saved memories.')
    }
    return () => {
      const recognition = recognitionRef.current
      recognitionRef.current = null
      recognition?.stop()
    }
  }, [])

  const applyProfile = (profile: MuseProfile) => {
    setAbout(profile.about)
    setKeypoints(profile.keypoints)
    setDrafts(profile.keypoints)
  }

  const save = () => {
    setError('')
    setMessage('')
    if (!about.trim()) {
      setMessage('Add a little about yourself first.')
      return
    }
    try {
      const profile = saveMuseProfile(about)
      applyProfile(profile)
      setMessage('Saved in this browser.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save your memories. Keep a copy of your text.')
    }
  }

  const changeMemory = (index: number, remove = false) => {
    setError('')
    setMessage('')
    if (remove && !window.confirm('Remove this memory from your profile? Existing stories will not be changed.')) return
    try {
      const points = remove ? keypoints.filter((_, position) => position !== index) :
        keypoints.map((point, position) => position === index ? drafts[index] : point)
      applyProfile(replaceMuseProfileKeypoints(points))
      setMessage(remove ? 'Memory removed from this browser profile.' : 'Memory updated in this browser.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update this memory. Your saved profile is unchanged.')
    }
  }

  const forget = () => {
    if (!window.confirm('Forget all profile memories in this browser? Previously generated stories and details already sent to AI are not erased.')) return
    setError('')
    setMessage('')
    try {
      forgetMuseProfile()
      const recognition = recognitionRef.current
      recognitionRef.current = null
      recognition?.stop()
      setIsRecording(false)
      setAbout('')
      setKeypoints([])
      setDrafts([])
      setMessage('All profile memories were removed from this browser. Existing stories were not changed.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not remove your memories.')
    }
  }

  const toggleRecording = () => {
    if (isRecording) {
      const recognition = recognitionRef.current
      recognitionRef.current = null
      recognition?.stop()
      setIsRecording(false)
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
      if (recognitionRef.current !== recognition) return
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
          setMessage('Voice input stopped. You can try again or type instead.')
        }
      }
    }
    recognitionRef.current = recognition
    setMessage('')
    try {
      recognition.start()
      setIsRecording(true)
    } catch {
      recognitionRef.current = null
      setIsRecording(false)
      setMessage('Could not start voice input. Check microphone permission or type instead.')
    }
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
          <h1 style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', lineHeight: 1.05, margin: '0.5rem 0 1rem' }}>What matters to you?</h1>
          <p style={{ maxWidth: 620, fontSize: '1.15rem', lineHeight: 1.7 }}>Save up to 20 memories in this browser. Saving does not send them to AI; include your latest five in My Story only if you choose. Browser storage is readable text, so keep this browser private.</p>
          <p style={{ maxWidth: 620, lineHeight: 1.7 }}>Speaking uses speech recognition from your browser or device and may be processed by an online speech service. Review the text before using it.</p>
          <section style={{ background: '#fffaf6', border: '1px solid #d9cfc5', borderRadius: 20, padding: '1.5rem', marginTop: '2rem' }}>
            <label style={{ display: 'block', fontWeight: 700 }}>What should Muse remember?
              <textarea value={about} onChange={(event) => setAbout(event.target.value)} rows={8} placeholder="People, places, feelings, things you love…" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '0.7rem', padding: '1rem', font: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <button onClick={save} style={{ border: 0, borderRadius: 999, background: '#2d2926', color: '#fffaf6', padding: '0.85rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>Save what matters</button>
              <button onClick={toggleRecording} style={{ padding: '0.85rem 1.1rem', cursor: 'pointer', background: isRecording ? '#a14329' : undefined, color: isRecording ? '#fffaf6' : undefined }}>{isRecording ? 'Stop listening' : 'Speak to Muse'}</button>
            </div>
            {message ? <p role="status" style={{ lineHeight: 1.6, marginBottom: 0 }}>{message}</p> : null}
            {error ? <p role="alert" style={{ color: '#a14329', lineHeight: 1.6 }}>{error}</p> : null}
          </section>
          <section style={{ marginTop: '1rem', padding: '1.25rem 1.5rem', border: '1px solid #d9cfc5', borderRadius: 18 }}>
            <h2 style={{ marginTop: 0 }}>Your memories</h2>
            {keypoints.length > 0 ? <ul style={{ lineHeight: 1.8, paddingLeft: '1.25rem' }}>{keypoints.map((keypoint, index) => <li key={keypoint} style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block' }}>Memory {index + 1}<input aria-label={`Memory ${index + 1}`} value={drafts[index] || ''} maxLength={180} onChange={(event) => setDrafts((current) => current.map((point, position) => position === index ? event.target.value : point))} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.65rem', font: 'inherit' }} /></label>
              <button onClick={() => changeMemory(index)} style={{ marginTop: '0.5rem', marginRight: '0.5rem' }}>Save memory {index + 1}</button>
              <button onClick={() => changeMemory(index, true)}>Remove memory {index + 1}</button>
            </li>)}</ul> : <p style={{ marginBottom: 0, opacity: 0.7 }}>No memories yet.</p>}
            <p>Removing memories does not erase existing stories or data already sent to AI.</p>
            <button onClick={forget}>Forget all memories</button>
          </section>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' }}>
            <Link href="/story" style={{ background: '#2d2926', color: '#fffaf6', borderRadius: 999, padding: '0.85rem 1.2rem', textDecoration: 'none', fontWeight: 700 }}>Create My Story →</Link>
            <Link href="/shared" style={{ color: '#2d2926', border: '1px solid #2d2926', borderRadius: 999, padding: '0.85rem 1.2rem', textDecoration: 'none' }}>Create a story for someone</Link>
          </div>
        </div>
      </main>
    </>
  )
}

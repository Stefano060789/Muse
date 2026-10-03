import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { answerPersonalStory, createPersonalStory, inferPersonalStoryMood, loadPersonalStory, savePersonalStory, type PersonalStory, type PersonalStoryMood } from '../lib/story'
import { loadMuseProfile } from '../lib/profile'

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

const moods: Array<{ key: PersonalStoryMood; title: string; description: string }> = [
  { key: 'adventure', title: 'Adventure', description: 'I want movement, courage, and something new.' },
  { key: 'relaxed', title: 'Relax', description: 'I need softness, quiet, and room to breathe.' },
  { key: 'curious', title: 'Curious', description: 'I want a question or a new perspective.' },
  { key: 'hopeful', title: 'Hopeful', description: 'I need help finding a next small possibility.' }
]

export default function StoryPage() {
  const [story, setStory] = useState<PersonalStory | null>(null)
  const [need, setNeed] = useState('')
  const [selectedMood, setSelectedMood] = useState<PersonalStoryMood>('curious')
  const [profileReady, setProfileReady] = useState(false)
  const [responseDraft, setResponseDraft] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioError, setAudioError] = useState('')
  const recognitionRef = useRef<Recognition | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    setStory(loadPersonalStory())
    setProfileReady(Boolean(loadMuseProfile()))
    return () => {
      recognitionRef.current?.stop()
      audioRef.current?.pause()
      window.speechSynthesis?.cancel()
    }
  }, [])

  const scene = useMemo(() => story?.scenes[story.currentStep] || null, [story])

  const begin = () => {
    const mood = need.trim() ? inferPersonalStoryMood(need) : selectedMood
    const profile = loadMuseProfile()
    const nextStory = createPersonalStory(mood, profile?.keypoints || [])
    savePersonalStory(nextStory)
    setStory(nextStory)
    setNeed('')
    setResponseDraft('')
  }

  const choose = (choice: string) => {
    if (!story) return
    const nextStory = answerPersonalStory(story, choice)
    savePersonalStory(nextStory)
    setStory(nextStory)
    setResponseDraft('')
  }

  const submitResponse = () => {
    if (responseDraft.trim()) choose(responseDraft)
  }

  const speakScene = async () => {
    if (!scene || !story) return
    const text = `${scene.title}. ${scene.body} ${scene.question}`
    setAudioError('')
    setIsLoadingAudio(true)

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mood: story.mood })
      })

      if (!response.ok) {
        if (!('speechSynthesis' in window)) throw new Error('Audio is not supported in this browser.')
        const utterance = new SpeechSynthesisUtterance(text)
        const voiceSettings = {
          adventure: { rate: 1.05, pitch: 1.08 },
          relaxed: { rate: 0.82, pitch: 0.9 },
          curious: { rate: 0.95, pitch: 1.08 },
          hopeful: { rate: 0.9, pitch: 1.02 }
        }[story.mood]
        utterance.rate = voiceSettings.rate
        utterance.pitch = voiceSettings.pitch
        utterance.onstart = () => setIsSpeaking(true)
        utterance.onend = () => setIsSpeaking(false)
        utterance.onerror = () => {
          setIsSpeaking(false)
          setAudioError('Audio playback failed. You can still read the scene and continue.')
        }
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(utterance)
        return
      }

      const audioUrl = URL.createObjectURL(await response.blob())
      audioRef.current?.pause()
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src)
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onplay = () => setIsSpeaking(true)
      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
      }
      audio.onerror = () => setIsSpeaking(false)
      await audio.play()
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : 'Could not play audio.')
    } finally {
      setIsLoadingAudio(false)
    }
  }

  const stopSpeaking = () => {
    audioRef.current?.pause()
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }

  const toggleRecording = () => {
    if (isRecording) {
      const recognition = recognitionRef.current
      recognitionRef.current = null
      recognition?.stop()
      return
    }
    const Constructor = (window as RecognitionWindow).SpeechRecognition || (window as RecognitionWindow).webkitSpeechRecognition
    if (!Constructor) return
    const recognition = new Constructor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0].transcript
      setResponseDraft(transcript.trim())
    }
    recognition.onerror = () => {
      setIsRecording(false)
      recognitionRef.current = null
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
    setIsRecording(true)
    recognition.start()
  }

  return (
    <>
      <Head><title>Muse — My Story</title><meta name="description" content="A personalized interactive story shaped by what you need today." /></Head>
      <main style={{ minHeight: '100vh', background: '#f7f3ed', color: '#2d2926', fontFamily: 'Georgia, serif' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}>
            <Link href="/" style={{ color: '#2d2926', textDecoration: 'none', fontWeight: 700, letterSpacing: '0.08em' }}>MUSE</Link>
            <Link href="/" style={{ color: '#2d2926', textDecoration: 'none' }}>Home</Link>
          </header>
          {!story ? (
            <section>
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.75rem', opacity: 0.65 }}>My Story</p>
              <h1 style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', lineHeight: 1.05, margin: '0.5rem 0 1rem' }}>What kind of story do you need today?</h1>
              <p style={{ maxWidth: 650, fontSize: '1.15rem', lineHeight: 1.7 }}>Choose a mood or tell Muse what is on your mind. Muse will shape an interactive story around your answer and offer you a next step at each scene.</p>
              {!profileReady ? <p style={{ background: '#fffaf6', border: '1px solid #d9cfc5', borderRadius: 12, padding: '0.8rem 1rem', maxWidth: 620 }}>Want it to feel more personal? <Link href="/myself" style={{ color: '#2d2926', fontWeight: 700 }}>Tell Muse about yourself first.</Link></p> : null}
              <div data-responsive-grid="moods" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.8rem', marginTop: '2rem' }}>
                {moods.map((mood) => <button key={mood.key} onClick={() => setSelectedMood(mood.key)} style={{ textAlign: 'left', padding: '1rem', borderRadius: 16, border: selectedMood === mood.key ? '2px solid #2d2926' : '1px solid #d9cfc5', background: selectedMood === mood.key ? '#fffaf6' : 'transparent', cursor: 'pointer', color: '#2d2926' }}><strong style={{ display: 'block', marginBottom: '0.4rem', fontSize: '1.1rem' }}>{mood.title}</strong><span style={{ lineHeight: 1.5 }}>{mood.description}</span></button>)}
              </div>
              <label style={{ display: 'block', maxWidth: 700, marginTop: '1.5rem', fontWeight: 700 }}>Or tell Muse what you need
                <textarea value={need} onChange={(event) => setNeed(event.target.value)} rows={4} placeholder="I feel restless and want to feel brave about what comes next…" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '0.6rem', padding: '1rem', font: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
              </label>
              <button onClick={begin} style={{ marginTop: '1rem', border: 0, borderRadius: 999, background: '#2d2926', color: '#fffaf6', padding: '0.95rem 1.3rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>Create my story →</button>
            </section>
          ) : (
            <section>
              {audioError ? <p role="alert" style={{ color: '#a14329', background: '#f9e7df', borderRadius: 10, padding: '0.8rem 1rem' }}>{audioError}</p> : null}
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.75rem', opacity: 0.65 }}>My Story · {story.mood}</p>
              <h1 style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', lineHeight: 1.05, margin: '0.5rem 0 1rem' }}>{story.title}</h1>
              <p style={{ maxWidth: 650, fontSize: '1.15rem', lineHeight: 1.7 }}>{story.description}</p>
              <div style={{ height: 6, borderRadius: 999, background: '#e2d8ce', margin: '2rem 0 1.5rem' }}><div style={{ height: '100%', borderRadius: 999, background: '#2d2926', width: `${((story.currentStep + 1) / story.scenes.length) * 100}%` }} /></div>
              <article style={{ maxWidth: 760, background: '#fffaf6', border: '1px solid #d9cfc5', borderRadius: 20, padding: '1.5rem' }}>
                <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.7rem', opacity: 0.65 }}>Scene {story.currentStep + 1} of {story.scenes.length}</p>
                <h2 style={{ margin: '0.5rem 0 1rem' }}>{scene?.title}</h2>
                <p style={{ fontSize: '1.15rem', lineHeight: 1.85 }}>{scene?.body}</p>
                <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', margin: '1rem 0 1.5rem' }}>
                  <button onClick={speakScene} disabled={isLoadingAudio || isSpeaking} style={{ padding: '0.7rem 0.9rem', cursor: isLoadingAudio || isSpeaking ? 'wait' : 'pointer' }}>{isLoadingAudio ? 'Preparing audio…' : isSpeaking ? 'Muse is speaking…' : 'Listen to this scene'}</button>
                  {isSpeaking ? <button onClick={stopSpeaking} style={{ padding: '0.7rem 0.9rem', cursor: 'pointer' }}>Stop audio</button> : null}
                </div>
                <h3  style={{ marginTop: '2rem' }}>{scene?.question}</h3>
                <textarea value={responseDraft} onChange={(event) => setResponseDraft(event.target.value)} rows={3} placeholder="Write or speak your answer…" style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.9rem', font: 'inherit', lineHeight: 1.5, resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
                  <button onClick={submitResponse} disabled={!responseDraft.trim()} style={{ padding: '0.75rem 1rem', border: 0, borderRadius: 999, background: '#2d2926', color: '#fffaf6', cursor: responseDraft.trim() ? 'pointer' : 'not-allowed' }}>Continue with my answer →</button>
                  <button onClick={toggleRecording} style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: isRecording ? '#a14329' : undefined, color: isRecording ? '#fffaf6' : undefined }}>{isRecording ? 'Stop listening' : 'Speak your answer'}</button>
                </div>
                <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.9rem', opacity: 0.65 }}>Or choose a direction:</p>
                <div style={{ display: 'grid', gap: '0.7rem' }}>{scene?.choices.map((choice) => <button key={choice} onClick={() => choose(choice)} style={{ textAlign: 'left', padding: '0.9rem 1rem', border: '1px solid #d9cfc5', borderRadius: 12, background: '#f7f3ed', color: '#2d2926', cursor: 'pointer', font: 'inherit' }}>{choice} →</button>)}</div>
              </article>
              {story.currentStep === story.scenes.length - 1 && story.responses.length >= story.scenes.length ? <div style={{ marginTop: '1rem', padding: '1rem 1.25rem', borderRadius: 14, background: '#e8eee3' }}>You have reached the end of this chapter. Start a new story whenever your needs change.</div> : null}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' }}><button onClick={() => { setStory(null); setNeed('') }} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>Create a different story</button><Link href="/myself" style={{ color: '#2d2926', padding: '0.8rem 0', fontWeight: 700 }}>Update Myself</Link></div>
            </section>
          )}
        </div>
      </main>
    </>
  )
}

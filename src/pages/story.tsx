import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { answerPersonalStory, inferPersonalStoryMood, loadPersonalStory, savePersonalStory, type PersonalStory, type PersonalStoryMood } from '../lib/story'
import { loadMuseProfile } from '../lib/profile'
import { useNarration } from '../lib/useNarration'
import NarrationControls, { NarrationButton } from '../components/NarrationControls'

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
  const [storyError, setStoryError] = useState('')
  const [storyNotice, setStoryNotice] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [useProfile, setUseProfile] = useState(false)
  const recognitionRef = useRef<Recognition | null>(null)
  const narrator = useNarration(story || {}, story?.mood || selectedMood)
  const stopSpeaking = narrator.stop

  useEffect(() => {
    try {
      setStory(loadPersonalStory())
      setProfileReady(Boolean(loadMuseProfile()))
    } catch (error) {
      setStoryNotice(error instanceof Error ? error.message : 'This browser could not restore your story or memories.')
    }
    return () => {
      const recognition = recognitionRef.current
      recognitionRef.current = null
      recognition?.stop()
    }
  }, [])

  const scene = useMemo(() => story?.scenes[story.currentStep] || null, [story])

  const requestStory = async (body: Record<string, unknown>): Promise<PersonalStory> => {
    const response = await fetch('/api/personal-story', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Could not generate your story.')
    return data
  }

  const persistStory = (nextStory: PersonalStory) => {
    setStory(nextStory)
    setStoryNotice('')
    try {
      savePersonalStory(nextStory)
    } catch (error) {
      setStoryNotice(error instanceof Error ? error.message : 'This browser could not save your story. It is available now, but may be lost when you leave.')
    }
  }

  const begin = async () => {
    if (isGenerating) return
    setIsGenerating(true)
    setStoryError('')
    stopSpeaking()
    stopRecording()
    const mood = need.trim() ? inferPersonalStoryMood(need) : selectedMood
    try {
      const profile = useProfile ? loadMuseProfile() : null
      const nextStory = await requestStory({ action: 'create', mood, need, profileKeypoints: profile?.keypoints.slice(-5) || [] })
      persistStory(nextStory)
      setNeed('')
      setResponseDraft('')
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : 'Could not generate your story.')
    } finally {
      setIsGenerating(false)
    }
  }

  const finished = Boolean(story && story.responses.length >= story.scenes.length)

  const choose = async (choice: string) => {
    if (!story || isGenerating || finished) return
    setStoryError('')
    setIsGenerating(true)
    stopSpeaking()
    const recognition = recognitionRef.current
    recognitionRef.current = null
    recognition?.stop()
    setIsRecording(false)
    try {
      const nextStory = story.generation === 'ai' && story.currentStep < story.scenes.length - 1
        ? await requestStory({ action: 'continue', story, answer: choice })
        : answerPersonalStory(story, choice)
      persistStory(nextStory)
      setResponseDraft('')
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : 'Could not continue your story.')
    } finally {
      setIsGenerating(false)
    }
  }

  const submitResponse = () => {
    if (responseDraft.trim()) choose(responseDraft)
  }

  const stopRecording = () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    recognition?.stop()
    setIsRecording(false)
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
      return
    }
    const Constructor = (window as RecognitionWindow).SpeechRecognition || (window as RecognitionWindow).webkitSpeechRecognition
    if (!Constructor) {
      setStoryError('Voice input is unavailable in this browser. Please type your answer instead.')
      return
    }
    setStoryError('')
    stopSpeaking()
    const recognition = new Constructor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0].transcript
      setResponseDraft(transcript.trim().slice(0, 600))
    }
    recognition.onerror = () => {
      if (recognitionRef.current !== recognition) return
      setIsRecording(false)
      recognitionRef.current = null
      setStoryError('Voice input failed. Check microphone permission or type your answer instead.')
    }
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        try {
          recognition.start()
        } catch {
          setIsRecording(false)
          recognitionRef.current = null
          setStoryError('Voice input stopped. Please try again or type your answer instead.')
        }
      }
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsRecording(true)
    } catch {
      recognitionRef.current = null
      setIsRecording(false)
      setStoryError('Could not start voice input. Check microphone permission or type your answer instead.')
    }
  }

  return (
    <>
      <Head><title>Muse — My Story</title><meta name="description" content="A personalized interactive story shaped by what you need today." /></Head>
      <main style={{ minHeight: '100vh', background: '#f7f3ed', color: '#2d2926', fontFamily: 'Georgia, serif' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}>
            <Link href="/" style={{ color: '#2d2926', textDecoration: 'none', fontWeight: 700, letterSpacing: '0.08em' }}>MUSE</Link>
            <nav style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link href="/library" style={{ color: '#2d2926', textDecoration: 'none' }}>Story Library</Link>
              <Link href="/" style={{ color: '#2d2926', textDecoration: 'none' }}>Home</Link>
            </nav>
          </header>
          {storyError ? <p role="alert" style={{ color: '#a14329', background: '#f9e7df', borderRadius: 10, padding: '0.8rem 1rem' }}>{storyError}</p> : null}
          {storyNotice ? <p role="status">{storyNotice}</p> : null}
          <NarrationControls narrator={narrator} beforeSpeak={stopRecording} />
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
                <textarea value={need} onChange={(event) => setNeed(event.target.value)} maxLength={1000} disabled={isGenerating} rows={4} placeholder="I feel restless and want to feel brave about what comes next…" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '0.6rem', padding: '1rem', font: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
              </label>
              {profileReady ? <label style={{ display: 'block', marginTop: '1rem' }}><input type="checkbox" checked={useProfile} disabled={isGenerating} onChange={(event) => setUseProfile(event.target.checked)} /> Include my latest five Myself key points in the AI request</label> : null}
              <p>Your need and, only if selected, profile key points are sent to the configured AI provider (Claude Haiku by default). Each story uses one generation and up to two AI continuations. Browser narration requires no narration credits.</p>
              <button onClick={begin} disabled={isGenerating} style={{ marginTop: '1rem', border: 0, borderRadius: 999, background: '#2d2926', color: '#fffaf6', padding: '0.95rem 1.3rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>{isGenerating ? 'Muse is writing your story...' : 'Create my story →'}</button>
            </section>
          ) : (
            <section>
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.75rem', opacity: 0.65 }}>My Story · {story.mood}</p>
              <h1 style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', lineHeight: 1.05, margin: '0.5rem 0 1rem' }}>{story.title}</h1>
              <p style={{ maxWidth: 650, fontSize: '1.15rem', lineHeight: 1.7 }}>{story.description}</p>
              <div style={{ height: 6, borderRadius: 999, background: '#e2d8ce', margin: '2rem 0 1.5rem' }}><div style={{ height: '100%', borderRadius: 999, background: '#2d2926', width: `${((story.currentStep + 1) / story.scenes.length) * 100}%` }} /></div>
              <article style={{ maxWidth: 760, background: '#fffaf6', border: '1px solid #d9cfc5', borderRadius: 20, padding: '1.5rem' }}>
                <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.7rem', opacity: 0.65 }}>Scene {story.currentStep + 1} of {story.scenes.length}</p>
                <h2 style={{ margin: '0.5rem 0 1rem' }}>{scene?.title}</h2>
                <p style={{ fontSize: '1.15rem', lineHeight: 1.85 }}>{scene?.body}</p>
                <NarrationButton narrator={narrator} text={scene ? `${scene.title}. ${scene.body} ${scene.question}` : ''} beforeSpeak={stopRecording} />
                <h3  style={{ marginTop: '2rem' }}>{scene?.question}</h3>
                <textarea value={responseDraft} onChange={(event) => setResponseDraft(event.target.value)} maxLength={600} disabled={isGenerating || finished} rows={3} placeholder="Write or speak your answer…" style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.9rem', font: 'inherit', lineHeight: 1.5, resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
                  <button onClick={submitResponse} disabled={!responseDraft.trim() || isGenerating || finished} style={{ padding: '0.75rem 1rem', border: 0, borderRadius: 999, background: '#2d2926', color: '#fffaf6', cursor: responseDraft.trim() ? 'pointer' : 'not-allowed' }}>{isGenerating ? 'Muse is writing the next scene...' : 'Continue with my answer →'}</button>
                  <button onClick={toggleRecording} disabled={isGenerating || finished} style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: isRecording ? '#a14329' : undefined, color: isRecording ? '#fffaf6' : undefined }}>{isRecording ? 'Stop listening' : 'Speak your answer'}</button>
                </div>
                <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.9rem', opacity: 0.65 }}>Or choose a direction:</p>
                <div style={{ display: 'grid', gap: '0.7rem' }}>{scene?.choices.map((choice) => <button key={choice} disabled={isGenerating || finished} onClick={() => choose(choice)} style={{ textAlign: 'left', padding: '0.9rem 1rem', border: '1px solid #d9cfc5', borderRadius: 12, background: '#f7f3ed', color: '#2d2926', cursor: 'pointer', font: 'inherit' }}>{choice} →</button>)}</div>
              </article>
              {story.currentStep === story.scenes.length - 1 && story.responses.length >= story.scenes.length ? <div style={{ marginTop: '1rem', padding: '1rem 1.25rem', borderRadius: 14, background: '#e8eee3' }}>You have reached the end of this chapter. Start a new story whenever your needs change.</div> : null}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' }}><button disabled={isGenerating} onClick={() => { stopSpeaking(); setStory(null); setNeed(''); setStoryError('') }} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>Create a different story</button><Link href="/myself" style={{ color: '#2d2926', padding: '0.8rem 0', fontWeight: 700 }}>Update Myself</Link></div>
            </section>
          )}
        </div>
      </main>
    </>
  )
}

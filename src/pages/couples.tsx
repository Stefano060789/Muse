import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { answerCurrentBeat, createStoryArc, decodeSharedStory, encodeSharedStory, loadStoryArc, saveStoryArc, STORY_TEMPLATES, type StoryArc } from '../lib/story'
import { loadMuseProfile, saveMuseProfile } from '../lib/profile'

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

export default function CouplesStoryPage() {
  const [story, setStory] = useState<StoryArc | null>(null)
  const [templateKey, setTemplateKey] = useState(STORY_TEMPLATES[0].key)
  const [partnerA, setPartnerA] = useState('You')
  const [partnerB, setPartnerB] = useState('Your partner')
  const [difficulty, setDifficulty] = useState<StoryArc['difficulty']>('gentle')
  const [durationMinutes, setDurationMinutes] = useState(15)
  const [goalType, setGoalType] = useState<StoryArc['goalType']>('puzzle')
  const [solution, setSolution] = useState('')
  const [completionMessage, setCompletionMessage] = useState('')
  const [shareMessage, setShareMessage] = useState('')
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
    const sharedValue = new URLSearchParams(window.location.search).get('share')
    const savedStory = sharedValue ? decodeSharedStory(sharedValue) : loadStoryArc()
    if (savedStory) {
      setStory(savedStory)
      setTemplateKey(savedStory.templateKey)
      setPartnerA(savedStory.partnerA)
      setPartnerB(savedStory.partnerB)
      setDifficulty(savedStory.difficulty || 'gentle')
      setDurationMinutes(savedStory.durationMinutes || 15)
      setGoalType(savedStory.goalType || 'puzzle')
      setSolution(savedStory.solution || '')
      setCompletionMessage(savedStory.completionMessage || '')
    }

    const savedProfile = loadMuseProfile()
    if (savedProfile) {
      setAbout(savedProfile.about)
      setProfileKeypoints(savedProfile.keypoints)
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
    if (!solution.trim()) {
      setError('Add the secret answer or solution so the other person can complete this story.')
      return
    }
    if (about.trim()) {
      const saved = await saveProfile()
      if (!saved) return
    }

    const nextStory = createStoryArc(templateKey, partnerA, partnerB, profileKeypoints, {
      difficulty,
      durationMinutes,
      goalType,
      solution,
      completionMessage
    })
    saveStoryArc(nextStory)
    setStory(nextStory)
    setResponse('')
  }

  const saveProfile = async () => {
    if (!about.trim()) {
      setError('Tell Muse something about yourself before saving your profile.')
      return false
    }

    const profile = saveMuseProfile(about)
    setProfileKeypoints(profile.keypoints)
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

  const shareStory = async () => {
    if (!story) return
    const shareUrl = `${window.location.origin}/couples?share=${encodeURIComponent(encodeSharedStory(story))}`
    if (!navigator.clipboard) {
      setShareMessage(`Copy this link to share: ${shareUrl}`)
      return
    }
    await navigator.clipboard.writeText(shareUrl)
    setShareMessage('Share link copied. The recipient can open it to play.')
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
        if ('speechSynthesis' in window) {
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
      const recognition = recognitionRef.current
      recognitionRef.current = null
      recognition?.stop()
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
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript
      }
      setResponse(transcript.trim())
    }
    recognition.onerror = () => {
      setIsRecording(false)
      recognitionRef.current = null
      setError('Could not understand the recording. Please try again.')
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

  const toggleProfileRecording = () => {
    if (isProfileRecording) {
      const recognition = recognitionRef.current
      recognitionRef.current = null
      recognition?.stop()
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
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript
      }
      setAbout(transcript.trim())
    }
    recognition.onerror = () => {
      setIsProfileRecording(false)
      recognitionRef.current = null
      setError('Could not understand the recording. Please try again.')
    }
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        try {
          recognition.start()
        } catch {
          setIsProfileRecording(false)
          recognitionRef.current = null
        }
      }
    }

    recognitionRef.current = recognition
    setIsProfileRecording(true)
    recognition.start()
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f7f3ed', color: '#2d2926', fontFamily: 'Georgia, serif' }}>
      <Head>
        <title>Muse — Shared story</title>
        <meta name="description" content="Create a meaningful story together, one small discovery at a time." />
      </Head>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: '#2d2926', textDecoration: 'none', fontWeight: 700, letterSpacing: '0.08em' }}>MUSE</Link>
          <Link href="/" style={{ color: '#2d2926', textDecoration: 'none', fontSize: '0.95rem' }}>Back to home</Link>
        </header>

        {error ? <p role="alert" style={{ color: '#a14329', background: '#f9e7df', borderRadius: 10, padding: '0.8rem 1rem', marginBottom: '1.25rem' }}>{error}</p> : null}

        {!story ? (
          <section>
            <div style={{ maxWidth: 650, marginBottom: '2rem' }}>
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: '0.75rem', opacity: 0.65, margin: 0 }}>A story for two</p>
              <h1 style={{ fontSize: 'clamp(2.4rem, 6vw, 4rem)', lineHeight: 1.05, margin: '0.6rem 0 1rem' }}>Begin somewhere meaningful.</h1>
              <p style={{ fontSize: '1.15rem', lineHeight: 1.7, margin: 0 }}>Set up a few details, then Muse will open the first scene for you both.</p>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ border: '1px solid #d9cfc5', borderRadius: 18, padding: '1.5rem', background: '#fffaf6' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.65 }}>Step 1 · Personalize (optional)</p>
                <h2 style={{ margin: '0.5rem 0 0.75rem' }}>Give Muse a little context</h2>
                <p style={{ lineHeight: 1.65, marginTop: 0 }}>Share a memory, place, or feeling. This stays in this browser and helps shape the opening scene.</p>
                <textarea value={about} onChange={(event) => setAbout(event.target.value)} rows={4} placeholder="A place you love, a shared memory, or the kind of evening you want to create…" style={{ display: 'block', width: '100%', padding: '0.9rem', fontSize: '1rem', resize: 'vertical', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
                  <button onClick={toggleProfileRecording} style={{ padding: '0.7rem 0.9rem', cursor: 'pointer', background: isProfileRecording ? '#a14329' : undefined, color: isProfileRecording ? '#fffaf6' : undefined }}>{isProfileRecording ? 'Stop listening' : 'Use your voice'}</button>
                  <button onClick={saveProfile} style={{ padding: '0.7rem 0.9rem', cursor: 'pointer' }}>Save context</button>
                </div>
                {isProfileRecording ? <p style={{ marginBottom: 0, fontSize: '0.9rem', opacity: 0.7 }}>Listening… speak naturally, then stop.</p> : null}
                {profileKeypoints.length > 0 ? <p style={{ marginBottom: 0, fontSize: '0.9rem', opacity: 0.7 }}>{profileKeypoints.length} {profileKeypoints.length === 1 ? 'detail' : 'details'} saved for this story.</p> : null}
              </div>

              <div style={{ border: '1px solid #d9cfc5', borderRadius: 18, padding: '1.5rem', background: '#fffaf6' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.65 }}>Step 2 · Story setup</p>
                <h2 style={{ margin: '0.5rem 0 1rem' }}>Choose your story</h2>
                <label style={{ display: 'block', marginBottom: '1rem' }}>Story style
                  <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '0.45rem', padding: '0.8rem', fontSize: '1rem' }}>
                    {STORY_TEMPLATES.map((template) => <option key={template.key} value={template.key}>{template.title}</option>)}
                  </select>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <label>Your name<input value={partnerA} onChange={(e) => setPartnerA(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '0.45rem', padding: '0.8rem', fontSize: '1rem', boxSizing: 'border-box' }} /></label>
                  <label>Your partner's name<input value={partnerB} onChange={(e) => setPartnerB(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '0.45rem', padding: '0.8rem', fontSize: '1rem', boxSizing: 'border-box' }} /></label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  <label>Difficulty<select value={difficulty} onChange={(e) => setDifficulty(e.target.value as StoryArc['difficulty'])} style={{ display: 'block', width: '100%', marginTop: '0.45rem', padding: '0.8rem', fontSize: '1rem' }}><option value="gentle">Gentle</option><option value="clever">Clever</option><option value="challenging">Challenging</option></select></label>
                  <label>Approximate time<select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} style={{ display: 'block', width: '100%', marginTop: '0.45rem', padding: '0.8rem', fontSize: '1rem' }}><option value={10}>10 minutes</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>About an hour</option></select></label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  <label>How should it conclude?<select value={goalType} onChange={(e) => setGoalType(e.target.value as StoryArc['goalType'])} style={{ display: 'block', width: '100%', marginTop: '0.45rem', padding: '0.8rem', fontSize: '1rem' }}><option value="puzzle">Solve a puzzle</option><option value="location">Reach a location</option><option value="item">Find an item</option><option value="letter">Find a letter</option></select></label>
                  <label>Secret answer or solution<input value={solution} onChange={(e) => setSolution(e.target.value)} placeholder="Only the solver should know" style={{ display: 'block', width: '100%', marginTop: '0.45rem', padding: '0.8rem', fontSize: '1rem', boxSizing: 'border-box' }} /></label>
                </div>
                <label style={{ display: 'block', marginTop: '1rem' }}>Message when solved<input value={completionMessage} onChange={(e) => setCompletionMessage(e.target.value)} placeholder="You found it. Meet me at the place we love." style={{ display: 'block', width: '100%', marginTop: '0.45rem', padding: '0.8rem', fontSize: '1rem', boxSizing: 'border-box' }} /></label>
              </div>

              <button onClick={startStory} style={{ padding: '1rem 1.2rem', fontSize: '1.05rem', cursor: 'pointer', border: 0, borderRadius: 999, background: '#2d2926', color: '#fffaf6', fontWeight: 700 }}>Begin the story →</button>
              <p style={{ textAlign: 'center', margin: 0, fontSize: '0.9rem', opacity: 0.65 }}>You can change these details any time by starting a new story.</p>
            </div>
          </section>
        ) : (
          <section>
            <div style={{ maxWidth: 650, marginBottom: '1.5rem' }}>
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: '0.75rem', opacity: 0.65, margin: 0 }}>{story.partnerA} + {story.partnerB} · Beat {story.currentBeat + 1} of {story.beats.length}</p>
              <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', lineHeight: 1.05, margin: '0.55rem 0 0.75rem' }}>{story.title}</h1>
              <p style={{ lineHeight: 1.7, margin: 0 }}>{story.description}</p>
              <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: 0 }}>{story.difficulty || 'gentle'} · about {story.durationMinutes || 15} minutes · solve to reveal the ending</p>
              {story.solved ? <p role="status" style={{ background: '#e8eee3', borderRadius: 12, padding: '0.9rem 1rem', marginBottom: 0 }}>{story.completionMessage || 'The story is solved.'}</p> : null}
            </div>

            <div style={{ height: 6, borderRadius: 999, background: '#e2d8ce', marginBottom: '1.25rem' }}><div style={{ height: '100%', borderRadius: 999, background: '#2d2926', width: `${((story.currentBeat + 1) / story.beats.length) * 100}%` }} /></div>

            <div style={{ border: '1px solid #d9cfc5', borderRadius: 18, padding: '1.5rem', background: '#fffaf6' }}>
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.7rem', opacity: 0.65, margin: 0 }}>The next scene</p>
              <h2 style={{ margin: '0.5rem 0 0.85rem' }}>{currentBeat?.title}</h2>
              <p style={{ lineHeight: 1.85, marginTop: 0 }}>{currentBeat?.body}</p>
              <p style={{ fontStyle: 'italic', lineHeight: 1.7, marginBottom: 0 }}><strong>Clue:</strong> {currentBeat?.clue}</p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
                <button onClick={() => speakText(`${currentBeat?.body || ''} ${currentBeat?.clue || ''}`)} disabled={isLoadingAudio || isSpeaking} style={{ padding: '0.7rem 0.9rem', cursor: isLoadingAudio || isSpeaking ? 'wait' : 'pointer' }}>{isLoadingAudio ? 'Preparing audio…' : isSpeaking ? 'Muse is speaking…' : 'Listen to scene'}</button>
                {isSpeaking ? <button onClick={() => { audioRef.current?.pause(); window.speechSynthesis.cancel(); setIsSpeaking(false) }} style={{ padding: '0.7rem 0.9rem', cursor: 'pointer' }}>Stop audio</button> : null}
              </div>
            </div>

            <div style={{ border: '1px solid #d9cfc5', borderRadius: 18, padding: '1.5rem', marginTop: '1rem' }}>
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.7rem', opacity: 0.65, margin: 0 }}>Your turn</p>
              <h2 style={{ margin: '0.5rem 0 0.75rem' }}>What does this bring to mind?</h2>
              <textarea aria-label="Your answer / discovery" value={response} onChange={(e) => setResponse(e.target.value)} rows={4} placeholder="Write a memory, guess, or feeling…" style={{ display: 'block', width: '100%', padding: '0.9rem', fontSize: '1rem', resize: 'vertical', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
                <button onClick={handleAnswer} disabled={!response.trim()} style={{ padding: '0.8rem 1.1rem', cursor: response.trim() ? 'pointer' : 'not-allowed', border: 0, borderRadius: 999, background: '#2d2926', color: '#fffaf6', fontWeight: 700, opacity: response.trim() ? 1 : 0.55 }}>Save and continue →</button>
                <button onClick={toggleRecording} style={{ padding: '0.8rem 1rem', cursor: 'pointer', background: isRecording ? '#a14329' : undefined, color: isRecording ? '#fffaf6' : undefined }}>{isRecording ? 'Stop listening' : 'Answer by voice'}</button>
              </div>
              <p style={{ marginBottom: 0, fontSize: '0.9rem', opacity: 0.65 }}>{isRecording ? 'Listening… speak your answer, then stop.' : 'You can review your answer before continuing.'}</p>
            </div>

            <details style={{ marginTop: '1rem', border: '1px solid #d9cfc5', borderRadius: 14, padding: '1rem 1.25rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Earlier discoveries ({Object.keys(story.responses).length})</summary>
              {Object.keys(story.responses).length > 0 ? <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.8, marginBottom: 0 }}>{Object.entries(story.responses).map(([beat, answer]) => <li key={beat}><strong>Beat {beat}:</strong> {answer}</li>)}</ul> : <p style={{ marginBottom: 0 }}>Your saved discoveries will appear here.</p>}
            </details>
            <div style={{ marginTop: '1rem' }}>
              <button onClick={shareStory} style={{ padding: '0.8rem 1rem', border: 0, borderRadius: 999, background: '#2d2926', color: '#fffaf6', cursor: 'pointer', fontWeight: 700 }}>Share this story →</button>
              {shareMessage ? <p role="status" style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{shareMessage}</p> : null}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

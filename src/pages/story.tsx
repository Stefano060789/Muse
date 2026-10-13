import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { answerPersonalStory, loadPersonalStory, savePersonalStory, type PersonalStory, type PersonalStoryMood } from '../lib/story'
import { loadMuseProfile } from '../lib/profile'
import { useNarration } from '../lib/useNarration'
import NarrationControls, { NarrationButton } from '../components/NarrationControls'
import { useStoryInteraction } from '../lib/useStoryInteraction'
import type { StoryChoiceMode } from '../lib/freeformStory'
const PREPARATION_KEY = 'muse-personal-journey-preparation'
type Preparation = { id: string; capability: string }

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
  const [duration, setDuration] = useState(10)
  const [choiceMode, setChoiceMode] = useState<StoryChoiceMode>('free')
  const [creatorCode, setCreatorCode] = useState('')
  const [dictationLanguage, setDictationLanguage] = useState('en-US')
  const [reconciled, setReconciled] = useState(false)
  const [preparation, setPreparation] = useState<Preparation | null>(null)
  const [storyError, setStoryError] = useState('')
  const [storyNotice, setStoryNotice] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [useProfile, setUseProfile] = useState(false)
  const requestLock = useRef(false)
  const narrator = useNarration(story || {}, story?.mood || selectedMood)
  const stopSpeaking = narrator.stop
  const interaction = useStoryInteraction(stopSpeaking, dictationLanguage)
  const stopRecording = interaction.stopRecording
  const isRecording = Boolean(interaction.recordingTarget)

  useEffect(() => {
    try {
      setStory(loadPersonalStory())
      setProfileReady(Boolean(loadMuseProfile()))
      const raw = window.localStorage.getItem(PREPARATION_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (!/^[0-9a-f-]{36}$/i.test(saved.id) || !/^[0-9a-f]{64}$/i.test(saved.capability)) throw new Error('Invalid saved preparation capability.')
        setPreparation({ id: saved.id, capability: saved.capability })
      }
    } catch (error) {
      setStoryNotice(error instanceof Error ? error.message : 'This browser could not restore your story or memories.')
    }
    const invalidate = () => setReconciled(false)
    window.addEventListener('focus', invalidate)
    window.addEventListener('storage', invalidate)
    return () => { window.removeEventListener('focus', invalidate); window.removeEventListener('storage', invalidate) }
  }, [])

  const scene = useMemo(() => story?.scenes[story.currentStep] || null, [story])

  const requestStory = async (body: Record<string, unknown>): Promise<PersonalStory> => {
    const response = await fetch('/api/personal-story', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-muse-creator-code': creatorCode }, body: JSON.stringify(body)
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Could not generate your story.')
    return data
  }

  const requestJourney = async (body: Record<string, unknown>) => {
    const response = await fetch('/api/personal-story', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-muse-creator-code': creatorCode },
      body: JSON.stringify({ mode: 'journey', ...body })
    })
    const data = await response.json()
    const saved = data.story ? persistStory(data.story) : false
    if (!response.ok) throw new Error(data.error || 'Could not complete this attempt. Reconcile before continuing.')
    if (data.status === 'failed' || data.snapshot?.status === 'failed') throw new Error('This attempt failed and was consumed. No automatic retry is made.')
    if (data.story && saved) {
      window.localStorage.removeItem(PREPARATION_KEY)
      setPreparation(null)
    }
    setReconciled(!data.snapshot?.pending)
    return data
  }

  const reconcile = async () => {
    const saved = preparation || (story?.journey ? { id: story.id, capability: story.journey.capability } : null)
    if (!saved || requestLock.current) return
    requestLock.current = true
    setIsGenerating(true); setStoryError(''); setReconciled(false)
    stopSpeaking(); stopRecording()
    try {
      const data = await requestJourney({ action: 'resume', ...saved })
      if (!data.story) setStoryNotice('Preparation is still pending. Reconcile later; this does not trigger another AI request.')
    } catch (error) { setStoryError(error instanceof Error ? error.message : 'Could not reconcile your story.') }
    finally { requestLock.current = false; setIsGenerating(false) }
  }

  const abandonPreparation = () => {
    try {
      window.localStorage.removeItem(PREPARATION_KEY)
      setPreparation(null)
      setStoryError('')
    } catch {
      setStoryError('Could not remove the saved preparation. Check browser storage permissions before trying again.')
    }
  }

  const persistStory = (nextStory: PersonalStory) => {
    setStory(nextStory)
    setStoryNotice('')
    try {
      savePersonalStory(nextStory)
      return true
    } catch (error) {
      setStoryNotice(error instanceof Error ? error.message : 'This browser could not save your story. It is available now, but may be lost when you leave.')
      return false
    }
  }

  const begin = async () => {
    if (requestLock.current || preparation) return
    requestLock.current = true
    setIsGenerating(true)
    setStoryError('')
    stopSpeaking()
    stopRecording()
    try {
      const profile = useProfile ? loadMuseProfile() : null
      const saved = {
        id: crypto.randomUUID(),
        capability: Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
      }
      window.localStorage.setItem(PREPARATION_KEY, JSON.stringify(saved))
      setPreparation(saved)
      await requestJourney({ action: 'create', ...saved, mood: selectedMood, duration, choiceMode, need, profileKeypoints: profile?.keypoints.slice(-5) || [] })
      setNeed('')
      setResponseDraft('')
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : 'Could not generate your story.')
    } finally {
      requestLock.current = false
      setIsGenerating(false)
    }
  }

  const finished = Boolean(story && (story.journey ? ['concluded', 'exhausted'].includes(story.journey.status) : story.responses.length >= story.scenes.length))

  const choose = async (choice: string) => {
    if (!story || requestLock.current || finished || (story.journey && (!reconciled || story.journey.pending))) return
    requestLock.current = true
    setStoryError('')
    setIsGenerating(true)
    stopSpeaking()
    stopRecording()
    try {
      if (story.journey) {
        setReconciled(false)
        await requestJourney({ action: 'respond', id: story.id, capability: story.journey.capability, revision: story.journey.revision, requestId: crypto.randomUUID(), text: choice })
        setResponseDraft('')
        return
      }
      const nextStory = story.generation === 'ai' && story.currentStep < story.scenes.length - 1
        ? await requestStory({ action: 'continue', story, answer: choice })
        : answerPersonalStory(story, choice)
      persistStory(nextStory)
      setResponseDraft('')
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : 'Could not continue your story.')
    } finally {
      requestLock.current = false
      setIsGenerating(false)
    }
  }

  const submitResponse = () => {
    if (responseDraft.trim()) choose(responseDraft)
  }

  const toggleRecording = () => {
    interaction.dictate('response', value => setResponseDraft(value.slice(0, story?.journey ? 800 : 600)))
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
          {interaction.error ? <p role="alert">{interaction.error}</p> : null}
          <label style={{ display: 'block', marginBottom: '1rem' }}>Creator access code (if required by this deployment)
            <input type="password" autoComplete="off" maxLength={512} value={creatorCode} disabled={isGenerating} onChange={event => { setCreatorCode(event.target.value); setReconciled(false) }} style={{ display: 'block', padding: '0.6rem', width: '100%', maxWidth: 400 }} />
          </label>
          <p>The code stays in page memory only. Saved personal capabilities are private and remain in this browser.</p>
          <NarrationControls narrator={narrator} beforeSpeak={stopRecording} />
          {preparation || story?.journey ? <div style={{ margin: '1rem 0' }}>
            <button onClick={reconcile} disabled={isGenerating}>Resume / reconcile saved progress (no AI call)</button>
            {!reconciled || story?.journey?.pending ? <p>Reconcile before sending a response. Pending or uncertain attempts are never automatically retried. Stale attempts expire after 90 seconds and stay consumed.</p> : null}
            {preparation ? <p>Saved preparation awaiting reconciliation. <button disabled={isGenerating} onClick={abandonPreparation}>Abandon preparation (does not refund attempts)</button></p> : null}
          </div> : null}
          {!story ? (
            <section>
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.75rem', opacity: 0.65 }}>My Story</p>
              <h1 style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', lineHeight: 1.05, margin: '0.5rem 0 1rem' }}>What kind of story do you need today?</h1>
              <p style={{ maxWidth: 650, fontSize: '1.15rem', lineHeight: 1.7 }}>Choose your mood, then how you want to interact. Write your own actions or pick from Muse's suggestions. Either way, the story responds to what you choose.</p>
              {!profileReady ? <p style={{ background: '#fffaf6', border: '1px solid #d9cfc5', borderRadius: 12, padding: '0.8rem 1rem', maxWidth: 620 }}>Want it to feel more personal? <Link href="/myself" style={{ color: '#2d2926', fontWeight: 700 }}>Tell Muse about yourself first.</Link></p> : null}
              <div data-responsive-grid="moods" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.8rem', marginTop: '2rem' }}>
                {moods.map((mood) => <button key={mood.key} disabled={isGenerating || Boolean(preparation)} aria-pressed={selectedMood === mood.key} onClick={() => setSelectedMood(mood.key)} style={{ textAlign: 'left', padding: '1rem', borderRadius: 16, border: selectedMood === mood.key ? '2px solid #2d2926' : '1px solid #d9cfc5', background: selectedMood === mood.key ? '#fffaf6' : 'transparent', cursor: 'pointer', color: '#2d2926' }}><strong style={{ display: 'block', marginBottom: '0.4rem', fontSize: '1.1rem' }}>{mood.title}</strong><span style={{ lineHeight: 1.5 }}>{mood.description}</span></button>)}
              </div>
              <label style={{ display: 'block', marginTop: '1rem' }}>Approximate duration
                <select aria-label="Approximate duration" value={duration} disabled={isGenerating || Boolean(preparation)} onChange={event => setDuration(Number(event.target.value))}>
                  {[5, 10, 15, 20].map(minutes => <option key={minutes} value={minutes}>{minutes} minutes · up to {minutes * 3 / 5} responses</option>)}
                </select>
              </label>
              <label style={{ display: 'block', marginTop: '1rem' }}>How do you want to interact?
                <select aria-label="Story interaction" value={choiceMode} disabled={isGenerating || Boolean(preparation)} onChange={event => setChoiceMode(event.target.value as StoryChoiceMode)}>
                  <option value="free">Free choice - write or speak your action</option>
                  <option value="suggested">Suggested choices - pick from 3 to 5 actions</option>
                </select>
              </label>
              <p>Muse narrates the consequences in either mode. Suggestions come with each scene, with no extra AI request.</p>
              <label style={{ display: 'block', maxWidth: 700, marginTop: '1.5rem', fontWeight: 700 }}>Optionally tell Muse what you need
                <textarea value={need} onChange={(event) => setNeed(event.target.value)} maxLength={1000} disabled={isGenerating} rows={4} placeholder="I feel restless and want to feel brave about what comes next…" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '0.6rem', padding: '1rem', font: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
              </label>
              {profileReady ? <label style={{ display: 'block', marginTop: '1rem' }}><input type="checkbox" checked={useProfile} disabled={isGenerating} onChange={(event) => setUseProfile(event.target.checked)} /> Include my latest five Myself key points in the AI request</label> : null}
              <p>Your need and, only if selected, profile key points go to the configured AI provider. Opening and compact plan use one generation; each response uses one AI call, up to {duration * 3 / 5} attempts including failures. Time is approximate, never a cutoff timer. The final successful response at the cap concludes the story. Failed final attempts cannot be retried or refunded. Browser narration is free; browser dictation may use your browser&apos;s speech service.</p>
              <button onClick={begin} disabled={isGenerating || Boolean(preparation)} style={{ marginTop: '1rem', border: 0, borderRadius: 999, background: '#2d2926', color: '#fffaf6', padding: '0.95rem 1.3rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>{isGenerating ? 'Muse is writing your story...' : 'Create my story →'}</button>
            </section>
          ) : (
            <section>
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.75rem', opacity: 0.65 }}>My Story · {story.mood}</p>
              <h1 style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', lineHeight: 1.05, margin: '0.5rem 0 1rem' }}>{story.title}</h1>
              <p style={{ maxWidth: 650, fontSize: '1.15rem', lineHeight: 1.7 }}>{story.description}</p>
              <div style={{ height: 6, borderRadius: 999, background: '#e2d8ce', margin: '2rem 0 1.5rem' }}><div style={{ height: '100%', borderRadius: 999, background: '#2d2926', width: `${(story.journey ? story.journey.revision / story.journey.maxTurns : (story.currentStep + 1) / story.scenes.length) * 100}%` }} /></div>
              <article style={{ maxWidth: 760, background: '#fffaf6', border: '1px solid #d9cfc5', borderRadius: 20, padding: '1.5rem' }}>
                <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.7rem', opacity: 0.65 }}>{story.journey ? `About ${story.journey.duration} minutes · ${story.journey.revision}/${story.journey.maxTurns} attempts used · ${story.journey.status}` : `Scene ${story.currentStep + 1} of ${story.scenes.length}`}</p>
                <h2 style={{ margin: '0.5rem 0 1rem' }}>{scene?.title}</h2>
                <p style={{ fontSize: '1.15rem', lineHeight: 1.85 }}>{scene?.body}</p>
                <NarrationButton narrator={narrator} text={scene ? `${scene.title}. ${scene.body} ${scene.question}` : ''} beforeSpeak={stopRecording} />
                {story.journey?.state ? <details><summary>Journey memory</summary>{(['inventory', 'discoveries', 'relationships'] as const).map(key => <p key={key}>{key}: {story.journey!.state![key].join(', ') || 'None yet'}</p>)}<p>{story.journey.state.progress}</p></details> : null}
                {!finished ? <>
                <h3 style={{ marginTop: '2rem' }}>{story.journey ? 'What do you do or say?' : scene?.question}</h3>
                {story.journey?.choiceMode === 'suggested' ? <>
                  <p>Choose an action. Muse will narrate its consequences (one response attempt).</p>
                  <div role="group" aria-label="Suggested actions" style={{ display: 'grid', gap: '0.7rem' }}>
                    {story.journey.choices?.map(choice => <button key={choice} disabled={isGenerating || !reconciled || story.journey?.pending} onClick={() => void choose(choice)} style={{ textAlign: 'left', padding: '0.9rem 1rem', border: '1px solid #d9cfc5', borderRadius: 12, background: '#f7f3ed', color: '#2d2926', font: 'inherit', cursor: 'pointer' }}>{choice}</button>)}
                  </div>
                  {!story.journey.choices?.length ? <p>Reconcile saved progress to load the available actions.</p> : null}
                </> : <>
                <label>Editable response
                <textarea aria-label="Editable response" value={responseDraft} onChange={(event) => setResponseDraft(event.target.value)} maxLength={story.journey ? 800 : 600} disabled={isGenerating || finished || Boolean(story.journey && (!reconciled || story.journey.pending))} rows={3} placeholder="Write or dictate, then edit before sending…" style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.9rem', font: 'inherit', lineHeight: 1.5, resize: 'vertical' }} />
                </label>
                <label>Dictation language <select value={dictationLanguage} disabled={isGenerating || isRecording} onChange={event => setDictationLanguage(event.target.value)}>
                  <option value="en-US">English</option><option value="de-DE">Deutsch</option><option value="it-IT">Italiano</option><option value="fr-FR">Français</option><option value="es-ES">Español</option>
                </select></label>
                <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
                  <button onClick={submitResponse} disabled={!responseDraft.trim() || isGenerating || finished || Boolean(story.journey && (!reconciled || story.journey.pending))} style={{ padding: '0.75rem 1rem', border: 0, borderRadius: 999, background: '#2d2926', color: '#fffaf6', cursor: responseDraft.trim() ? 'pointer' : 'not-allowed' }}>{isGenerating ? 'Muse is writing the next scene...' : 'Continue with my answer →'}</button>
                  <button onClick={toggleRecording} disabled={isGenerating || finished || Boolean(story.journey && (!reconciled || story.journey.pending))} style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: isRecording ? '#a14329' : undefined, color: isRecording ? '#fffaf6' : undefined }}>{isRecording ? 'Stop listening' : 'Speak your answer'}</button>
                </div>
                {isRecording ? <p role="status">{interaction.ready ? 'Listening - speak now' : 'Starting microphone…'}</p> : null}
                </>}
                {!story.journey ? <>
                <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.9rem', opacity: 0.65 }}>Or choose a direction (legacy story):</p>
                <div style={{ display: 'grid', gap: '0.7rem' }}>{scene?.choices.map((choice) => <button key={choice} disabled={isGenerating || finished} onClick={() => choose(choice)} style={{ textAlign: 'left', padding: '0.9rem 1rem', border: '1px solid #d9cfc5', borderRadius: 12, background: '#f7f3ed', color: '#2d2926', cursor: 'pointer', font: 'inherit' }}>{choice} →</button>)}</div>
                </> : null}
                </> : null}
              </article>
              {finished ? <div style={{ marginTop: '1rem', padding: '1rem 1.25rem', borderRadius: 14, background: '#e8eee3' }}>{story.journey?.status === 'exhausted' ? 'The allowance is exhausted, including failed attempts. The last available narration remains saved; no additional AI conclusion is charged.' : 'Your story has reached its conclusion.'} Narration and library reopening remain available.</div> : null}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' }}><button disabled={isGenerating || Boolean(preparation)} onClick={() => { stopSpeaking(); stopRecording(); setStory(null); setNeed(''); setStoryError(''); setReconciled(false) }} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>Create a different story</button><Link href="/myself" style={{ color: '#2d2926', padding: '0.8rem 0', fontWeight: 700 }}>Update Myself</Link></div>
            </section>
          )}
        </div>
      </main>
    </>
  )
}

import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { answerPersonalStory, loadPersonalStory, savePersonalStory, type PersonalStory, type PersonalStoryMood } from '../lib/story'
import { loadMuseProfile, saveMuseProfile } from '../lib/profile'
import { useNarration } from '../lib/useNarration'
import NarrationControls, { NarrationButton } from '../components/NarrationControls'
import ReadAlongText from '../components/ReadAlongText'
import HoldToSpeakButton from '../components/HoldToSpeakButton'
import { useStoryInteraction } from '../lib/useStoryInteraction'
import type { StoryChoiceMode } from '../lib/freeformStory'
import ExplicitConsent from '../components/ExplicitConsent'
import { hasExplicitConsent, MUSE_AI_CONSENT_VERSION } from '../lib/legalContact'
import { STORY_LANGUAGES, storyLanguage, type StoryLanguageCode } from '../lib/storyLanguage'
import RomanceOptions from '../components/RomanceOptions'
import { requireRomanceConfirmation, romanceCopy, type StoryRomance } from '../lib/storyRomance'
const PREPARATION_KEY = 'muse-personal-journey-preparation'
type Preparation = { id: string; capability: string }

const moods: Array<{ key: PersonalStoryMood; title: string; description: string }> = [
  { key: 'adventure', title: 'Adventure', description: 'Try something new.' },
  { key: 'relaxed', title: 'Relax', description: 'Slow down.' },
  { key: 'curious', title: 'Curious', description: 'Discover a new perspective.' },
  { key: 'hopeful', title: 'Hopeful', description: 'Find a way forward.' }
]

export default function StoryPage() {
  const [story, setStory] = useState<PersonalStory | null>(null)
  const [need, setNeed] = useState('')
  const [selectedMood, setSelectedMood] = useState<PersonalStoryMood>('curious')
  const [profileReady, setProfileReady] = useState(false)
  const [profileDraft, setProfileDraft] = useState('')
  const [responseDraft, setResponseDraft] = useState('')
  const [duration, setDuration] = useState(10)
  const [choiceMode, setChoiceMode] = useState<StoryChoiceMode>('free')
  const [language, setLanguage] = useState<StoryLanguageCode>('en-US')
  const [romance, setRomance] = useState<StoryRomance | undefined>()
  const [romanceConfirmed, setRomanceConfirmed] = useState(false)
  const [creatorCode, setCreatorCode] = useState('')
  const [reconciled, setReconciled] = useState(false)
  const [preparation, setPreparation] = useState<Preparation | null>(null)
  const [storyError, setStoryError] = useState('')
  const [storyNotice, setStoryNotice] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [useProfile, setUseProfile] = useState(true)
  const [aiConsent, setAiConsent] = useState(false)
  const [creationStep, setCreationStep] = useState(0)
  const creationSection = useRef<HTMLElement>(null)
  const requestLock = useRef(false)
  const narrator = useNarration(story || {}, story?.mood || selectedMood, {
    progress: story?.journey ? story.journey.revision / story.journey.maxTurns
      : story ? story.currentStep / Math.max(1, story.scenes.length - 1) : 0,
    ending: story?.journey ? story.journey.status === 'concluded' : Boolean(story && story.currentStep >= story.scenes.length - 1),
    sceneKey: story ? `${story.id}:${story.journey?.revision ?? story.currentStep}` : 'new'
  }, { creatorCode })
  const stopSpeaking = narrator.stop
  const interaction = useStoryInteraction(stopSpeaking, story?.language || language)
  const stopRecording = interaction.stopRecording
  const isRecording = Boolean(interaction.recordingTarget)
  const moveCreationStep = (step: number) => {
    interaction.cancelRecording()
    setCreationStep(step)
    setStoryError('')
    requestAnimationFrame(() => {
      creationSection.current?.focus()
      creationSection.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
    })
  }
  useEffect(() => { setRomanceConfirmed(false) }, [romance])

  useEffect(() => {
    try {
      setStory(loadPersonalStory())
      const profile = loadMuseProfile()
      setProfileReady(Boolean(profile))
      setProfileDraft(profile?.about || '')
      const raw = window.localStorage.getItem(PREPARATION_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (!/^[0-9a-f-]{36}$/i.test(saved.id) || !/^[0-9a-f]{64}$/i.test(saved.capability)) throw new Error('Invalid saved preparation capability.')
        setPreparation({ id: saved.id, capability: saved.capability })
      }
    } catch (error) {
      setStoryNotice(error instanceof Error ? error.message : 'This browser could not restore your story or memories.')
    }
  }, [])

  const scene = useMemo(() => story?.scenes[story.currentStep] || null, [story])
  const sceneTitle = scene?.title.trim().replace(/\s+/g, ' ') || ''
  const sceneBody = scene?.body.trim().replace(/\s+/g, ' ') || ''
  const sceneQuestion = scene?.question.trim().replace(/\s+/g, ' ') || ''
  const narrationText = scene ? `${sceneTitle}. ${sceneBody} ${sceneQuestion}` : ''
  const sceneBodyStart = sceneTitle ? sceneTitle.length + 2 : 0
  const sceneQuestionStart = sceneBodyStart + sceneBody.length + 1

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
    try {
      const data = await requestJourney({ action: 'resume', ...saved })
      if (!data.story) setStoryNotice('Your story is still being prepared. Progress is checked automatically without another AI request.')
    } catch (error) { setStoryError(error instanceof Error ? error.message : 'Could not reconcile your story.') }
    finally { requestLock.current = false; setIsGenerating(false) }
  }

  const reconcileRef = useRef(reconcile)
  reconcileRef.current = reconcile
  useEffect(() => {
    if (!story?.journey && !preparation) return
    void reconcileRef.current()
    const refresh = () => { void reconcileRef.current() }
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh) }
  }, [story?.id, Boolean(story?.journey), preparation?.id, creatorCode])

  useEffect(() => {
    if ((!story?.journey && !preparation) || isGenerating || (reconciled && !story?.journey?.pending)) return
    const timer = window.setTimeout(() => { void reconcileRef.current() }, storyError ? 15000 : 3000)
    return () => window.clearTimeout(timer)
  }, [story?.id, Boolean(story?.journey), story?.journey?.pending, preparation?.id, reconciled, isGenerating, storyError])

  const savePersonalTouches = () => {
    interaction.cancelRecording()
    try {
      saveMuseProfile(profileDraft)
      setProfileReady(true)
      setStoryNotice('Personal touches saved in this browser. Your latest five memories are included by default; you can leave them out below.')
      setAiConsent(false)
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : 'Could not save your personal touches.')
    }
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
    if (!hasExplicitConsent(aiConsent)) {
      setStoryError('Review the AI disclosure and check the consent box before creating your story.')
      return
    }
    try { requireRomanceConfirmation(romance, romanceConfirmed) } catch (error) {
      setStoryError(error instanceof Error ? error.message : 'Confirm the romance boundaries before creating your story.')
      return
    }
    const consentVersion = MUSE_AI_CONSENT_VERSION
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
      await requestJourney({ action: 'create', ...saved, mood: selectedMood, duration, choiceMode, language, ...(romance ? { romance, romanceConfirmed } : {}), need, profileKeypoints: profile?.keypoints.slice(-5) || [], consentVersion })
      setRomanceConfirmed(false)
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
    if (!story || requestLock.current || finished) return
    if (story.journey && (!reconciled || story.journey.pending)) {
      setStoryError('Your saved progress is being checked automatically before sending. Your answer is kept.')
      return
    }
    const sendsToAi = Boolean(story.journey || (story.generation === 'ai' && story.currentStep < story.scenes.length - 1))
    if (sendsToAi && !hasExplicitConsent(aiConsent)) {
      setStoryError('Review the AI disclosure and check the consent box before sending your response.')
      return
    }
    const consentVersion = sendsToAi ? MUSE_AI_CONSENT_VERSION : undefined
    requestLock.current = true
    setStoryError('')
    setIsGenerating(true)
    stopSpeaking()
    interaction.cancelRecording()
    try {
      if (story.journey) {
        setReconciled(false)
        await requestJourney({ action: 'respond', id: story.id, capability: story.journey.capability, revision: story.journey.revision, requestId: crypto.randomUUID(), text: choice, consentVersion })
        setResponseDraft(current => current === choice ? '' : current)
        return
      }
      const nextStory = story.generation === 'ai' && story.currentStep < story.scenes.length - 1
        ? await requestStory({ action: 'continue', story, answer: choice, consentVersion })
        : answerPersonalStory(story, choice)
      persistStory(nextStory)
      setResponseDraft(current => current === choice ? '' : current)
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

  const startDictation = () => interaction.dictate('response', value => {
    setResponseDraft(value.slice(0, story?.journey ? 800 : 600))
  })

  return (
    <>
      <Head><title>{story ? 'Muse - Your story' : 'Muse - Create a story'}</title><meta name="description" content="A personalized interactive story shaped by what you need today." /></Head>
      <main className="atelier-page">
        <div className="atelier-shell atelier-shell--narrow">
          {storyError ? <p role="alert" style={{ color: '#a14329', background: '#f9e7df', borderRadius: 10, padding: '0.8rem 1rem' }}>{storyError}</p> : null}
          {storyNotice ? <p role="status">{storyNotice}</p> : null}
          {interaction.error ? <p role="alert">{interaction.error}</p> : null}
          <details style={{ marginBottom: '1rem' }}>
          <summary>Creator access (beta)</summary>
          <label style={{ display: 'block', marginBottom: '1rem' }}>Creator access code (if required)
            <input type="password" autoComplete="off" maxLength={512} value={creatorCode} disabled={isGenerating} onChange={event => { setCreatorCode(event.target.value); setReconciled(false) }} style={{ display: 'block', padding: '0.6rem', width: '100%', maxWidth: 400 }} />
          </label>
          <p>Code never saved. Keep this browser private.</p>
          </details>
          {story ? <details style={{ marginBottom: '1rem' }}>
            <summary>Audio settings</summary>
            <NarrationControls narrator={narrator} beforeSpeak={stopRecording} showCloudConsent={false} />
          </details> : null}
          {preparation || story?.journey ? <div style={{ margin: '1rem 0' }}>
            {!reconciled || story?.journey?.pending ? <p role="status">{isGenerating ? 'Checking your saved progress...' : 'Progress is checked automatically. You can keep writing your answer.'}</p> : null}
            {preparation ? <p>Unfinished preparation. <button disabled={isGenerating} onClick={abandonPreparation}>Abandon (no refund)</button></p> : null}
          </div> : null}
          {!story ? (
            <section ref={creationSection} tabIndex={-1} aria-labelledby="creation-title">
              <p className="atelier-eyebrow">A story for you</p>
              <h1 id="creation-title" className="atelier-title">Create a story</h1>
              <p className="atelier-subtitle">{['Choose a feeling. Muse will turn it into an interactive story, with you deciding what happens next.', 'A few small details help shape your escape. Keep it simple, or add something personal.', 'Review your choices before Muse begins writing.'][creationStep]}</p>
              <ol className="atelier-progress" aria-label="Story creation steps">
                {['Choose a mood', 'Make it yours', 'Review & create'].map((label, index) => <li key={label} aria-current={creationStep === index ? 'step' : undefined}>{index + 1}. {label}</li>)}
              </ol>
              <fieldset hidden={creationStep !== 0} disabled={creationStep !== 0 || isGenerating || Boolean(preparation)} style={{ border: 0, margin: 0, padding: 0 }}>
              <legend className="atelier-eyebrow">How would you like to feel?</legend>
              <div data-responsive-grid="moods" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.8rem', marginTop: '2rem' }}>
                {moods.map((mood) => <button key={mood.key} disabled={isGenerating || Boolean(preparation)} aria-pressed={selectedMood === mood.key} onClick={() => { setSelectedMood(mood.key); setAiConsent(false) }} style={{ textAlign: 'left', padding: '1rem', borderRadius: 16, border: selectedMood === mood.key ? '2px solid #2d2926' : '1px solid #d9cfc5', background: selectedMood === mood.key ? '#fffaf6' : 'transparent', cursor: 'pointer', color: '#2d2926' }}><strong style={{ display: 'block', marginBottom: '0.4rem', fontSize: '1.1rem' }}>{mood.title}</strong><span style={{ lineHeight: 1.5 }}>{mood.description}</span></button>)}
              </div>
              <RomanceOptions value={romance} onChange={value => { setRomance(value); setAiConsent(false) }} confirmed={romanceConfirmed} onConfirm={setRomanceConfirmed} disabled={isGenerating || Boolean(preparation)} />
              </fieldset>
              <fieldset hidden={creationStep !== 1} disabled={creationStep !== 1 || isGenerating || Boolean(preparation)} className="atelier-card" style={{ margin: 0 }}>
              <legend>Your story, your pace</legend>
              <div className="atelier-form-grid">
              <label style={{ display: 'block', marginTop: '1rem' }}>Approximate duration
                <select aria-label="Approximate duration" value={duration} disabled={isGenerating || Boolean(preparation)} onChange={event => { setDuration(Number(event.target.value)); setAiConsent(false) }}>
                  {[5, 10, 15, 20].map(minutes => <option key={minutes} value={minutes}>{minutes} minutes · up to {minutes * 3 / 5} responses</option>)}
                </select>
              </label>
              <label style={{ display: 'block', marginTop: '1rem' }}>Story language
                <select aria-label="Story language" value={language} disabled={isGenerating || Boolean(preparation)} onChange={event => { setLanguage(event.target.value as StoryLanguageCode); setAiConsent(false) }}>
                  {STORY_LANGUAGES.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
                </select>
              </label>
              </div>
              <p className="atelier-note">Your story, actions and voice input use this language.</p>
              <label style={{ display: 'block', marginTop: '1rem' }}>How do you want to interact?
                <select aria-label="Story interaction" value={choiceMode} disabled={isGenerating || Boolean(preparation)} onChange={event => { setChoiceMode(event.target.value as StoryChoiceMode); setAiConsent(false) }}>
                  <option value="free">Write or speak freely</option>
                  <option value="suggested">Choose from 3–5 actions</option>
                </select>
              </label>
              <label style={{ display: 'block', maxWidth: 700, marginTop: '1.5rem', fontWeight: 700 }}>What do you need? (optional)
                <textarea value={need} onChange={(event) => { setNeed(event.target.value); setAiConsent(false) }} maxLength={1000} disabled={isGenerating} rows={4} placeholder="I feel restless and want to feel brave about what comes next…" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '0.6rem', padding: '1rem', font: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
              </label>
              <details style={{ marginTop: '1rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Personal touches (optional)</summary>
                <p>Memories saved here or on Home personalize new stories by default. Review them here or leave them out below. They are sent to AI only when you consent to creating this story.</p>
                <label>What should Muse remember?
                  <textarea aria-label="Personal touches" value={profileDraft} onFocus={() => interaction.cancelRecording()} onChange={event => { interaction.cancelRecording(); setProfileDraft(event.target.value) }} maxLength={4000} rows={3} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.9rem', font: 'inherit' }} />
                </label>
                <HoldToSpeakButton label="Hold to speak personal touches" recording={interaction.recordingTarget === 'profile'}
                  onStart={() => interaction.dictate('profile', value => setProfileDraft(value.slice(0, 4000)))}
                  onStop={() => stopRecording('profile')} disabled={creationStep !== 1 || isGenerating || Boolean(preparation)} />
                <p className="atelier-note">Voice input may use an online speech service. Release to finish, then edit before saving.</p>
                <button type="button" disabled={!profileDraft.trim() || isGenerating} onClick={savePersonalTouches}>Save personal touches</button>
                {profileReady ? <label style={{ display: 'block', marginTop: '1rem' }}><input type="checkbox" checked={useProfile} disabled={isGenerating} onChange={(event) => { setUseProfile(event.target.checked); setAiConsent(false) }} /> Include my latest five saved memories in this story</label> : null}
              </details>
              </fieldset>
              <fieldset hidden={creationStep !== 2} disabled={creationStep !== 2 || isGenerating || Boolean(preparation)} className="atelier-card" style={{ margin: 0 }}>
              <legend>One last look</legend>
              <p><strong>{moods.find(mood => mood.key === selectedMood)?.title}</strong> · About {duration} minutes · {storyLanguage(language).label}</p>
              <p>{choiceMode === 'suggested' ? 'Choose from suggested actions.' : 'Write or speak your own responses.'}{useProfile && profileReady ? ' Your latest five memories will be included.' : ' No profile memories included.'}</p>
              {need ? <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{need}</p> : null}
              {romance ? <p>{romanceCopy(language).title(romance)}. <button type="button" onClick={() => moveCreationStep(0)}>Change theme</button></p> : null}
              <p>One AI call to start; one per response. Up to {duration * 3 / 5} response attempts, including failures.</p>
              <ExplicitConsent checked={aiConsent} onChange={setAiConsent}>
                I understand that my need, story settings and each response I choose to send are shared with Muse&apos;s configured AI provider to create this story. My latest five saved memories are included by default unless I leave them out in Personal touches. The story is stored on Muse&apos;s server until I delete it. This consent applies to this story only.
              </ExplicitConsent>
              {narrator.provider !== 'browser' ? <ExplicitConsent checked={narrator.cloudConsent} onChange={narrator.setCloudConsent}>
                Enable optional narration: send story text to {narrator.provider === 'google' ? 'Google Cloud' : 'ElevenLabs'} when I choose Listen. New recordings use the narration allowance; saved recordings are reused. <Link href="/privacy">Privacy</Link>
              </ExplicitConsent> : null}
              <details style={{ marginTop: '1rem' }}>
                <summary>Privacy and limits</summary>
                <p>Your need and selected memories go to the configured AI provider. Duration is approximate, not a timer. The last successful response concludes the story; failed final attempts cannot be retried or refunded.</p>
                <p>Your creator code is never saved. Private story access stays in this browser. Browser narration is free; narration and dictation may use online speech services.</p>
              </details>
              <button className="atelier-button" onClick={begin} disabled={isGenerating || Boolean(preparation)} style={{ marginTop: '1rem' }}>{isGenerating ? 'Muse is writing your story...' : 'Create my story →'}</button>
              </fieldset>
              <div className="atelier-actions">
                {creationStep > 0 ? <button className="atelier-secondary" disabled={isGenerating || Boolean(preparation)} onClick={() => moveCreationStep(creationStep - 1)}>Back</button> : null}
                {creationStep < 2 ? <button className="atelier-button" disabled={isGenerating || Boolean(preparation)} onClick={() => moveCreationStep(creationStep + 1)}>Continue</button> : null}
              </div>
            </section>
          ) : (
            <section className="atelier-reading">
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.75rem', opacity: 0.65 }}>My Story · {story.mood}</p>
              {story.romance ? <p>{romanceCopy(story.language).title(story.romance)}</p> : null}
              <h1 lang={story.language} dir={story.language ? storyLanguage(story.language).dir : undefined} style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', lineHeight: 1.05, margin: '0.5rem 0 1rem' }}>{story.title}</h1>
              <p lang={story.language} dir={story.language ? storyLanguage(story.language).dir : undefined} style={{ maxWidth: 650, fontSize: '1.15rem', lineHeight: 1.7 }}>{story.description}</p>
              <div style={{ height: 6, borderRadius: 999, background: '#e2d8ce', margin: '2rem 0 1.5rem' }}><div style={{ height: '100%', borderRadius: 999, background: '#2d2926', width: `${(story.journey ? story.journey.revision / story.journey.maxTurns : (story.currentStep + 1) / story.scenes.length) * 100}%` }} /></div>
              {(story.journey || (story.generation === 'ai' && story.currentStep < story.scenes.length - 1)) && !finished ? (
                <ExplicitConsent checked={aiConsent} onChange={setAiConsent}>
                  I understand that my story settings, need and each response I choose to send are shared with Muse&apos;s configured AI provider to create this story. My latest five saved memories were included unless I left them out during creation. The story is stored on Muse&apos;s server until I delete it. This consent applies to this story only.
                </ExplicitConsent>
              ) : null}
              {narrator.provider !== 'browser' && !narrator.cloudConsent ? <details style={{ marginBottom: '1rem' }}>
                <summary>Enable optional narration</summary>
                <ExplicitConsent checked={narrator.cloudConsent} onChange={narrator.setCloudConsent}>
                  Send story text to {narrator.provider === 'google' ? 'Google Cloud' : 'ElevenLabs'} when I choose Listen. New recordings use the narration allowance; saved recordings are reused. <Link href="/privacy">Privacy</Link>
                </ExplicitConsent>
              </details> : null}
              <article lang={story.language} dir={story.language ? storyLanguage(story.language).dir : undefined} style={{ maxWidth: 760, background: '#fffaf6', border: '1px solid #d9cfc5', borderRadius: 20, padding: '1.5rem' }}>
                <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.7rem', opacity: 0.65 }}>{story.journey ? `About ${story.journey.duration} minutes · ${story.journey.revision}/${story.journey.maxTurns} attempts used · ${story.journey.status}` : `Scene ${story.currentStep + 1} of ${story.scenes.length}`}</p>
                <h2 style={{ margin: '0.5rem 0 1rem' }}><ReadAlongText text={sceneTitle} startAt={0} position={narrator.textPosition} active={narrator.speaking || narrator.paused} /></h2>
                <p className="atelier-prose"><ReadAlongText text={sceneBody} startAt={sceneBodyStart} position={narrator.textPosition} active={narrator.speaking || narrator.paused} /></p>
                <NarrationButton narrator={narrator} text={narrationText} beforeSpeak={stopRecording} showCloudConsent={false} />
                {story.journey?.state ? <details><summary>Journey memory</summary>{(['inventory', 'discoveries', 'relationships'] as const).map(key => <p key={key}>{key}: {story.journey!.state![key].join(', ') || 'None yet'}</p>)}<p>{story.journey.state.progress}</p></details> : null}
                {!finished ? <>
                <h3 style={{ marginTop: '2rem' }}>{story.journey && !sceneQuestion ? 'What do you do or say?' : <ReadAlongText text={sceneQuestion} startAt={sceneQuestionStart} position={narrator.textPosition} active={narrator.speaking || narrator.paused} />}</h3>
                {story.journey?.choiceMode === 'suggested' ? <>
                  <p>Each choice uses one AI attempt.</p>
                  <div role="group" aria-label="Suggested actions" style={{ display: 'grid', gap: '0.7rem' }}>
                    {story.journey.choices?.map(choice => <button key={choice} disabled={isGenerating || !reconciled || story.journey?.pending} onClick={() => void choose(choice)} style={{ textAlign: 'left', padding: '0.9rem 1rem', border: '1px solid #d9cfc5', borderRadius: 12, background: '#f7f3ed', color: '#2d2926', font: 'inherit', cursor: 'pointer' }}>{choice}</button>)}
                  </div>
                  {!story.journey.choices?.length ? <p>Your actions load automatically when progress is checked.</p> : null}
                </> : <>
                <label>Editable response
                <textarea aria-label="Editable response" value={responseDraft} onFocus={() => interaction.cancelRecording()} onChange={(event) => { interaction.cancelRecording(); setResponseDraft(event.target.value) }} maxLength={story.journey ? 800 : 600} disabled={finished} rows={3} placeholder="Write or dictate, then edit before sending…" style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.9rem', font: 'inherit', lineHeight: 1.5, resize: 'vertical' }} />
                </label>
                <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
                  <button onClick={submitResponse} disabled={!responseDraft.trim() || isGenerating || finished || Boolean(story.journey && (!reconciled || story.journey.pending))} style={{ padding: '0.75rem 1rem', border: 0, borderRadius: 999, background: '#2d2926', color: '#fffaf6', cursor: responseDraft.trim() ? 'pointer' : 'not-allowed' }}>{isGenerating ? 'Muse is writing the next scene...' : 'Continue with my answer →'}</button>
                  <HoldToSpeakButton label="Hold to speak your answer" releaseLabel="Release to stop" recording={isRecording} onStart={startDictation} onStop={() => stopRecording('response')} disabled={isGenerating || finished || Boolean(story.journey && (!reconciled || story.journey.pending))} style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: isRecording ? '#a14329' : undefined, color: isRecording ? '#fffaf6' : undefined }} />
                </div>
                {isRecording ? <p role="status">{interaction.ready ? 'Listening — release when you are done.' : 'Starting microphone…'}</p> : null}
                {isRecording ? <button type="button" onClick={() => interaction.cancelRecording()}>Stop microphone and type</button> : null}
                </>}
                {!story.journey ? <>
                <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.9rem', opacity: 0.65 }}>Or choose a direction (legacy story):</p>
                <div style={{ display: 'grid', gap: '0.7rem' }}>{scene?.choices.map((choice) => <button key={choice} disabled={isGenerating || finished} onClick={() => choose(choice)} style={{ textAlign: 'left', padding: '0.9rem 1rem', border: '1px solid #d9cfc5', borderRadius: 12, background: '#f7f3ed', color: '#2d2926', cursor: 'pointer', font: 'inherit' }}>{choice} →</button>)}</div>
                </> : null}
                </> : null}
              </article>
              {finished ? <div style={{ marginTop: '1rem', padding: '1rem 1.25rem', borderRadius: 14, background: '#e8eee3' }}>{story.journey?.status === 'exhausted' ? 'Attempt limit reached, including failures. Your last scene is saved; no extra AI call is made.' : 'Your story is complete.'} You can still listen or reopen it.</div> : null}
            </section>
          )}
        </div>
      </main>
    </>
  )
}

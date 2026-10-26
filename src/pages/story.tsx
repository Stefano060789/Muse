import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { answerPersonalStory, loadPersonalStory, savePersonalStory, type PersonalStory, type PersonalStoryMood } from '../lib/story'
import { loadMuseProfile, saveMuseProfile } from '../lib/profile'
import { useNarration } from '../lib/useNarration'
import NarrationControls, { NarrationButton } from '../components/NarrationControls'
import ReadAlongText from '../components/ReadAlongText'
import StoryModeControl, { type StoryMode } from '../components/StoryModeControl'
import StoryPassage from '../components/StoryPassage'
import HoldToSpeakButton from '../components/HoldToSpeakButton'
import { useStoryInteraction } from '../lib/useStoryInteraction'
import type { StoryChoiceMode } from '../lib/freeformStory'
import ExplicitConsent from '../components/ExplicitConsent'
import { hasExplicitConsent, MUSE_AI_CONSENT_VERSION } from '../lib/legalContact'
import { STORY_LANGUAGES, storyLanguage, type StoryLanguageCode } from '../lib/storyLanguage'
import RomanceOptions from '../components/RomanceOptions'
import { requireRomanceConfirmation, romanceCopy, type StoryRomance } from '../lib/storyRomance'
import { removeLibraryEntry } from '../lib/storyLibrary'
import { readDraft, writeDraft, removeDraft } from '../lib/browserDrafts'
import { loadStoryPreferences, saveStoryPreferences } from '../lib/storyPreferences'
import { PERSONAL_DRAFT_KEY, isPersonalDraft, isResponseDraft, responseDraftKey } from '../lib/personalDraft'
import StoryKeepsake from '../components/StoryKeepsake'
import { accountFetch } from '../lib/accountClient'
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
  const [reconciled, setReconciled] = useState(false)
  const [reconciliationBlocked, setReconciliationBlocked] = useState(false)
  const [preparation, setPreparation] = useState<Preparation | null>(null)
  const [storyError, setStoryError] = useState('')
  const [storyNotice, setStoryNotice] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [useProfile, setUseProfile] = useState(true)
  const [aiConsent, setAiConsent] = useState(false)
  const [creationStep, setCreationStep] = useState(0)
  const [draftsReady, setDraftsReady] = useState(false)
  const [draftNotice, setDraftNotice] = useState('')
  const [draftError, setDraftError] = useState('')
  const [rereading, setRereading] = useState(false)
  const [archiveReading, setArchiveReading] = useState(false)
  const [storyMode, setStoryMode] = useState<StoryMode>('read')
  const [answerLoaded, setAnswerLoaded] = useState<string | null>(null)
  const draftWritable = useRef(true)
  const answerWritable = useRef(true)
  const creationSection = useRef<HTMLElement>(null)
  const requestLock = useRef(false)
  const deletedOnServer = useRef<string | null>(null)
  const narrator = useNarration(story || {}, story?.mood || selectedMood, {
    progress: story?.journey ? story.journey.revision / story.journey.maxTurns
      : story ? story.currentStep / Math.max(1, story.scenes.length - 1) : 0,
    ending: story?.journey ? story.journey.status === 'concluded' : Boolean(story && story.currentStep >= story.scenes.length - 1),
    sceneKey: story ? `${story.id}:${story.journey?.revision ?? story.currentStep}` : 'new'
  })
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
      setArchiveReading(new URLSearchParams(window.location?.search || '').get('read') === '1')
      setStory(new URLSearchParams(window.location?.search || '').get('new') === '1' ? null : loadPersonalStory())
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

  useEffect(() => {
    try {
      const preferences = loadStoryPreferences()
      setLanguage(preferences.language); setDuration(preferences.duration)
      const draft = readDraft(PERSONAL_DRAFT_KEY, isPersonalDraft)
      if (draft) {
        setNeed(draft.need); setSelectedMood(draft.mood); setChoiceMode(draft.choiceMode)
        setLanguage(draft.language); setDuration(draft.duration); setRomance(draft.romance)
        setUseProfile(draft.useProfile); setProfileDraft(draft.profileDraft); setCreationStep(draft.step)
        setDraftNotice('Draft restored. Review your choices and consent before creating.')
      }
    } catch (error) {
      draftWritable.current = false
      setDraftError(error instanceof Error ? error.message : 'Could not restore your draft or preferences.')
    }
    setDraftsReady(true)
  }, [])

  useEffect(() => {
    if (!draftsReady || story || preparation || !draftWritable.current) return
    try {
      writeDraft(PERSONAL_DRAFT_KEY, { need, mood: selectedMood, choiceMode, language, duration, romance, useProfile, profileDraft, step: creationStep })
      saveStoryPreferences({ language, duration })
      setDraftNotice('Draft saved in this browser.')
      setDraftError('')
    } catch {
      setDraftError('Your draft or preferences could not be saved. Keep this page open or copy your writing before leaving.')
    }
  }, [draftsReady, story, preparation, need, selectedMood, choiceMode, language, duration, romance, useProfile, profileDraft, creationStep])

  useEffect(() => {
    setAnswerLoaded(null)
    setRereading(false)
    answerWritable.current = true
    if (!story) return
    try {
      const saved = readDraft(responseDraftKey(story.id), isResponseDraft)
      setResponseDraft(saved?.revision === (story.journey?.revision ?? story.currentStep) ? saved.text : '')
      setAnswerLoaded(story.id)
    } catch {
      answerWritable.current = false
      setDraftError('Your saved answer could not be restored. It has not been overwritten.')
    }
  }, [story?.id])

  useEffect(() => {
    if (!story || answerLoaded !== story.id || !answerWritable.current) return
    try {
      if (responseDraft) writeDraft(responseDraftKey(story.id), { revision: story.journey?.revision ?? story.currentStep, text: responseDraft })
      else removeDraft(responseDraftKey(story.id))
      setDraftNotice(responseDraft ? 'Draft saved in this browser.' : '')
      setDraftError('')
    } catch {
      setDraftError('Your answer could not be saved in this browser. Copy it before leaving this page.')
    }
  }, [answerLoaded, story?.id, story?.journey?.revision, story?.currentStep, responseDraft])

  const scene = useMemo(() => story?.scenes[story.currentStep] || null, [story])
  const sceneTitle = scene?.title.trim().replace(/\s+/g, ' ') || ''
  const sceneBody = scene?.body.trim().replace(/\s+/g, ' ') || ''
  const sceneQuestion = scene?.question.trim().replace(/\s+/g, ' ') || ''
  const narrationText = scene ? `${sceneTitle}. ${sceneBody} ${sceneQuestion}` : ''
  const sceneBodyStart = sceneTitle ? sceneTitle.length + 2 : 0
  const sceneQuestionStart = sceneBodyStart + sceneBody.length + 1

  const requestStory = async (body: Record<string, unknown>): Promise<PersonalStory> => {
    const response = await accountFetch('/api/personal-story', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Could not generate your story.')
    return data
  }

  const requestJourney = async (body: Record<string, unknown>) => {
    const response = await accountFetch('/api/personal-story', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'journey', ...body })
    })
    const data = await response.json()
    const saved = data.story ? persistStory(data.story) : false
    if (data.snapshot?.status === 'failed' && !data.story) {
      window.localStorage.removeItem(PREPARATION_KEY)
      setPreparation(null)
      setReconciled(true)
    }
    setReconciliationBlocked(response.status === 401 || response.status === 404)
    if (!response.ok) throw new Error(data.error || 'Could not complete this attempt. Reconcile before continuing.')
    if (data.status === 'failed' || data.snapshot?.status === 'failed') throw new Error('This attempt failed and was consumed. No automatic retry is made.')
    if (data.story && saved) {
      window.localStorage.removeItem(PREPARATION_KEY)
      if (preparation) removeDraft(PERSONAL_DRAFT_KEY)
      setPreparation(null)
    }
    setReconciled(!data.snapshot?.pending)
    return data
  }

  const reconcile = async () => {
    const saved = preparation || (story?.journey ? { id: story.id, capability: story.journey.capability } : null)
    if (!saved || requestLock.current || deletedOnServer.current === saved.id) return
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
    const refresh = () => { setReconciliationBlocked(false); void reconcileRef.current() }
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh) }
  }, [story?.id, Boolean(story?.journey), preparation?.id])

  useEffect(() => {
    if ((!story?.journey && !preparation) || deletedOnServer.current === story?.id || isGenerating || reconciliationBlocked || (reconciled && !story?.journey?.pending)) return
    const timer = window.setTimeout(() => { void reconcileRef.current() }, storyError ? 15000 : 3000)
    return () => window.clearTimeout(timer)
  }, [story?.id, Boolean(story?.journey), story?.journey?.pending, preparation?.id, reconciled, reconciliationBlocked, isGenerating, storyError])

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
      setReconciliationBlocked(false)
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
    setReconciliationBlocked(false)
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
      removeDraft(PERSONAL_DRAFT_KEY)
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
    if (!story || requestLock.current || finished || archiveReading) return
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

  const deleteStory = async () => {
    if (!story || requestLock.current) return
    const selected = story
    const message = selected.journey
      ? 'Permanently delete this story and its saved progress from the server and this browser? This cannot be undone and does not refund used attempts.'
      : 'Delete this story and its saved progress from this browser? This cannot be undone.'
    if (!window.confirm(message)) return
    requestLock.current = true
    setIsGenerating(true)
    setStoryError('')
    stopSpeaking()
    interaction.cancelRecording()
    try {
      if (selected.journey && deletedOnServer.current !== selected.id) {
        const response = await accountFetch('/api/personal-story', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'journey', action: 'delete', id: selected.id, capability: selected.journey.capability })
        })
        const data = await response.json()
        if (!response.ok || data.deleted !== true) throw new Error(data.error || 'Story deletion was not confirmed. Your saved story has not been removed.')
        deletedOnServer.current = selected.id
      }
      removeLibraryEntry('personal', selected.id)
      removeDraft(responseDraftKey(selected.id))
      if (preparation?.id === selected.id) {
        window.localStorage.removeItem(PREPARATION_KEY)
        setPreparation(null)
      }
      setStory(null)
      setResponseDraft('')
      setAiConsent(false)
      setCreationStep(0)
      setReconciled(false)
      setStoryNotice('Story deleted.')
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Could not delete your story.'
      setStoryError(deletedOnServer.current === selected.id
        ? `The server story was deleted, but this browser could not finish removing its saved copy. Try Delete story again. ${detail}`
        : detail)
    } finally {
      requestLock.current = false
      setIsGenerating(false)
    }
  }

  const startDictation = () => interaction.dictate('response', value => {
    setResponseDraft(value.slice(0, story?.journey ? 800 : 600))
  })
  const sceneListening = storyMode === 'listen' && narrator.activeText === narrationText && (narrator.speaking || narrator.paused)
  const savedScenes = story ? <div lang={story.language} dir={story.language ? storyLanguage(story.language).dir : undefined}>
    {story.scenes.map((savedScene, index) => {
      const text = `${savedScene.title}. ${savedScene.body}`
      const active = storyMode === 'listen' && narrator.activeText === text && (narrator.speaking || narrator.paused)
      return <article key={index} className="atelier-card">
        <h3><StoryPassage text={savedScene.title} narrationText={text} position={narrator.textPosition} active={active} /></h3>
        <p style={{ whiteSpace: 'pre-wrap' }}><StoryPassage text={savedScene.body} narrationText={text} position={narrator.textPosition} active={active} /></p>
        {storyMode === 'listen' ? <NarrationButton narrator={narrator} text={text} beforeSpeak={stopRecording} showCloudConsent={false} /> : null}
      </article>
    })}
  </div> : null

  return (
    <>
      <Head><title>{story ? 'Muse - Your story' : 'Muse - Create a story'}</title><meta name="description" content="A personalized interactive story shaped by what you need today." /></Head>
      <main className="atelier-page">
        <div className="atelier-shell atelier-shell--narrow">
          {storyError ? <p role="alert" style={{ color: '#a14329', background: '#f9e7df', borderRadius: 10, padding: '0.8rem 1rem' }}>{storyError}</p> : null}
          {storyNotice ? <p role="status">{storyNotice}</p> : null}
          {draftError ? <p role="alert">{draftError}</p> : null}
          {draftNotice && (!story || responseDraft) ? <p role="status">{draftNotice}</p> : null}
          {interaction.error ? <p role="alert">{interaction.error}</p> : null}
          <p><Link href={archiveReading ? '/library' : '/my-stories'}>{archiveReading ? 'Back to archive' : 'Back to My stories'}</Link></p>
          {!story ? <p>Sign in to save personal stories to your account. <Link href="/account">Go to your Muse account</Link>.</p> : null}
          {preparation || story?.journey ? <div style={{ margin: '1rem 0' }}>
            {reconciliationBlocked ? <p role="status">This session could not be restored. Check that you are signed in to the original account. You can discard an unfinished preparation below without deleting saved stories.</p>
              : !reconciled || story?.journey?.pending ? <p role="status">{isGenerating ? 'Checking your saved progress...' : 'Progress is checked automatically. You can keep writing your answer.'}</p> : null}
            {preparation ? <p>Unfinished preparation. <button disabled={isGenerating} onClick={abandonPreparation}>Abandon (no refund)</button></p> : null}
          </div> : null}
          {!story ? (
            <section ref={creationSection} tabIndex={-1} aria-labelledby="creation-title">
              <p className="atelier-eyebrow">A story for you</p>
              <h1 id="creation-title" className="atelier-title">Create a story for yourself</h1>
              <p className="atelier-subtitle">{['This story is just for you. Choose a feeling and Muse will create an interactive adventure that you shape as you play.', 'Tell Muse what you need or add personal touches; you will write or speak your choices inside the story.', 'Review your choices before Muse begins writing.'][creationStep]}</p>
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
              <h1 className="story-reading-title" lang={story.language} dir={story.language ? storyLanguage(story.language).dir : undefined}>{story.title}</h1>
              <StoryModeControl mode={storyMode} onChange={mode => { narrator.stop(); stopRecording(); setStoryMode(mode) }} />
              {storyMode === 'listen' ? <details>
                <summary>Audio settings</summary>
                <NarrationControls narrator={narrator} beforeSpeak={stopRecording} />
              </details> : null}
              <details className="story-options"><summary>Story details and AI permission</summary>
              <p>{story.description}</p>
              {story.romance ? <p>{romanceCopy(story.language).title(story.romance)}</p> : null}
              <p>{story.journey ? `${story.journey.revision}/${story.journey.maxTurns} attempts used · ${story.journey.status}` : `Scene ${story.currentStep + 1} of ${story.scenes.length}`}</p>
              {(story.journey || (story.generation === 'ai' && story.currentStep < story.scenes.length - 1)) && !finished && !archiveReading ? (
                <ExplicitConsent checked={aiConsent} onChange={setAiConsent}>
                  I understand that my story settings, need and each response I choose to send are shared with Muse&apos;s configured AI provider to create this story. My latest five saved memories were included unless I left them out during creation. The story is stored on Muse&apos;s server until I delete it. This consent applies to this story only.
                </ExplicitConsent>
              ) : null}
              </details>
              {storyMode === 'listen' && narrator.provider !== 'browser' && !narrator.cloudConsent ? <details style={{ marginBottom: '1rem' }}>
                <summary>Enable optional narration</summary>
                <ExplicitConsent checked={narrator.cloudConsent} onChange={narrator.setCloudConsent}>
                  Send story text to {narrator.provider === 'google' ? 'Google Cloud' : 'ElevenLabs'} when I choose Listen. New recordings use the narration allowance; saved recordings are reused. <Link href="/privacy">Privacy</Link>
                </ExplicitConsent>
              </details> : null}
              {!archiveReading && !rereading ? <article lang={story.language} dir={story.language ? storyLanguage(story.language).dir : undefined} style={{ maxWidth: 760, background: '#fffaf6', border: '1px solid #d9cfc5', borderRadius: 20, padding: '1.5rem' }}>
                <h2 style={{ margin: '0.5rem 0 1rem' }}><ReadAlongText text={sceneTitle} startAt={0} position={narrator.textPosition} active={sceneListening} /></h2>
                <p className="atelier-prose"><ReadAlongText text={sceneBody} startAt={sceneBodyStart} position={narrator.textPosition} active={sceneListening} /></p>
                {storyMode === 'listen' ? <>
                <NarrationButton narrator={narrator} text={narrationText} beforeSpeak={stopRecording} showCloudConsent={false} />
                {narrator.ambientKind && narrator.ambientKind !== 'none' ? <p role="status">Soundscape: {narrator.ambientKind}</p> : null}
                {narrator.ambientNotice ? <p role="alert">{narrator.ambientNotice}</p> : null}
                {narrator.error ? <p role="alert">{narrator.error}</p> : null}
                </> : null}
                {story.journey?.state ? <details><summary>Journey memory</summary>{(['inventory', 'discoveries', 'relationships'] as const).map(key => <p key={key}>{key}: {story.journey!.state![key].join(', ') || 'None yet'}</p>)}<p>{story.journey.state.progress}</p></details> : null}
                {!finished && !archiveReading ? <>
                <h3 style={{ marginTop: '2rem' }}>{story.journey && !sceneQuestion ? 'What do you do or say?' : <ReadAlongText text={sceneQuestion} startAt={sceneQuestionStart} position={narrator.textPosition} active={sceneListening} />}</h3>
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
              </article> : null}
              {archiveReading ? <section aria-label="Archived story">
                <h2>Saved scenes</h2>
                {savedScenes}
                {storyMode === 'listen' && narrator.error ? <p role="alert">{narrator.error}</p> : null}
                {storyMode === 'listen' && narrator.ambientNotice ? <p role="alert">{narrator.ambientNotice}</p> : null}
                {storyMode === 'listen' && narrator.ambientKind && narrator.ambientKind !== 'none' ? <p role="status">Soundscape: {narrator.ambientKind}</p> : null}
                <p><Link href="/my-stories">Back to My stories</Link></p>
              </section> : null}
              {finished && !archiveReading ? <section aria-label="Your saved story" style={{ marginTop: '1rem', padding: '1rem 1.25rem', borderRadius: 14, background: '#e8eee3' }}>
                <h2>{story.journey?.status === 'exhausted' ? 'Your saved story' : 'Your story is complete.'}</h2>
                <p>{story.journey?.status === 'exhausted' ? 'The attempt limit was reached, including failures. Your available scenes are saved; no extra AI call is made.' : 'Take a moment. You can return to this story whenever you like.'}</p>
                <button type="button" onClick={() => { stopSpeaking(); setRereading(value => !value) }}>{rereading ? 'Close reading' : 'Read again'}</button>
                <StoryKeepsake story={{ title: story.title, creatorName: 'Muse', recipientName: 'you', scenes: story.scenes }} />
                <p className="atelier-note">The keepsake includes available story text, not your private answers, personal touches or access links.</p>
                {rereading ? savedScenes : null}
                {rereading && storyMode === 'listen' && narrator.error ? <p role="alert">{narrator.error}</p> : null}
                {rereading && storyMode === 'listen' && narrator.ambientNotice ? <p role="alert">{narrator.ambientNotice}</p> : null}
              </section> : null}
              <div style={{ marginTop: '2rem' }}>
                <button type="button" className="atelier-secondary" disabled={isGenerating || Boolean(story.journey?.pending)} onClick={() => void deleteStory()}>Delete story</button>
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  )
}

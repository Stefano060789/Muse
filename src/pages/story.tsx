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
import DictationButton from '../components/DictationButton'
import { recipientCopy } from '../lib/storyLanguage'
import { useStoryInteraction } from '../lib/useStoryInteraction'
import type { StoryChoiceMode } from '../lib/freeformStory'
import ExplicitConsent from '../components/ExplicitConsent'
import { useAccountPermissions } from '../lib/useAccountPermissions'
import { hasExplicitConsent, MUSE_AI_CONSENT_VERSION } from '../lib/legalContact'
import { STORY_LANGUAGES, storyLanguage, type StoryLanguageCode } from '../lib/storyLanguage'
import RomanceOptions from '../components/RomanceOptions'
import { requireRomanceConfirmation, romanceCopy, type StoryRomance } from '../lib/storyRomance'
import { registrationCopy } from '../lib/registrationCopy'
import { removeLibraryEntry, loadStoryLibrary, selectPersonalStory } from '../lib/storyLibrary'
import { readDraft, writeDraft, removeDraft } from '../lib/browserDrafts'
import { loadStoryPreferences, saveStoryPreferences } from '../lib/storyPreferences'
import { PERSONAL_DRAFT_KEY, isPersonalDraft, isResponseDraft, responseDraftKey } from '../lib/personalDraft'
import { accountFetch } from '../lib/accountClient'
import { interfacePageText as pageText } from '../lib/interfacePages'
import { interfaceText, useInterfaceLanguage } from '../lib/interfaceLanguage'
import { interfaceFlowText as flowText, type InterfaceFlowKey } from '../lib/interfaceFlow'
import { JOURNEY_ENDING_RECOVERY_ATTEMPTS } from '../lib/journeyLimits'
import { chapterRecoveryCopy } from '../lib/chapterRecoveryCopy'
import StoryLifeBridge from '../components/StoryLifeBridge'
const PREPARATION_KEY = 'muse-personal-journey-preparation'
type Preparation = { id: string; capability: string }

const moods: Array<{ key: PersonalStoryMood }> = [
  { key: 'adventure' }, { key: 'relaxed' }, { key: 'curious' }, { key: 'hopeful' }
]
const moodCopyKeys: Record<PersonalStoryMood, { title: InterfaceFlowKey; description: InterfaceFlowKey }> = {
  adventure: { title: 'moodAdventure', description: 'moodAdventureDescription' },
  relaxed: { title: 'moodRelaxed', description: 'moodRelaxedDescription' },
  curious: { title: 'moodCurious', description: 'moodCuriousDescription' },
  hopeful: { title: 'moodHopeful', description: 'moodHopefulDescription' }
}

export default function StoryPage() {
  const interfaceLanguage = useInterfaceLanguage()
  const flow = (key: Parameters<typeof flowText>[0]) => flowText(key, interfaceLanguage)
  const formatFlow = (key: Parameters<typeof flowText>[0], values: Record<string, string | number>) =>
    Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), flow(key))
  const chapterLabel = (number: number) => flow('chapter').replace('{number}', String(number))
  const journeyStatusLabels = {
    preparing: 'journeyPreparing', active: 'journeyActive', concluded: 'journeyConcluded',
    exhausted: 'journeyExhausted', failed: 'journeyFailed'
  } as const
  const soundLabels = {
    rain: 'soundRain', wind: 'soundWind', water: 'soundWater', crowd: 'soundCrowd',
    traffic: 'soundTraffic', mystery: 'soundMystery'
  } as const
  const soundscapeLabel = (kind: string) => {
    const key = kind in soundLabels ? soundLabels[kind as keyof typeof soundLabels] : null
    return formatFlow('soundscapeStatus', { kind: key ? flow(key) : kind })
  }
  const interfaceCopy = recipientCopy(interfaceLanguage)
  const moodTitle = (mood: PersonalStoryMood) => flow(moodCopyKeys[mood].title)
  const moodDescription = (mood: PersonalStoryMood) => flow(moodCopyKeys[mood].description)
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
  const permissions = useAccountPermissions()
  const [localRomanceConfirmed, setRomanceConfirmed] = useState(false)
  const romanceConfirmed = permissions.managed ? permissions.romance : localRomanceConfirmed
  const [reconciled, setReconciled] = useState(false)
  const [reconciliationBlocked, setReconciliationBlocked] = useState(false)
  const [preparation, setPreparation] = useState<Preparation | null>(null)
  const [storyError, setStoryError] = useState('')
  const [storyNotice, setStoryNotice] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [useProfile, setUseProfile] = useState(true)
  const [localAiConsent, setAiConsent] = useState(false)
  const aiConsent = permissions.ready && !permissions.error && (permissions.managed ? permissions.services : localAiConsent)
  const [creationStep, setCreationStep] = useState(0)
  const [draftsReady, setDraftsReady] = useState(false)
  const [draftNotice, setDraftNotice] = useState('')
  const [draftError, setDraftError] = useState('')
  const [rereading, setRereading] = useState(false)
  const [archiveReading, setArchiveReading] = useState(false)
  const [experience, setExperience] = useState<{ key: string; mode: StoryMode } | null>(null)
  const experienceKey = JSON.stringify([story?.id, story?.currentStep, archiveReading, rereading])
  const storyMode = experience?.key === experienceKey ? experience.mode : null
  const setStoryMode = (mode: StoryMode) => setExperience({ key: experienceKey, mode })
  const [chapterFormOpen, setChapterFormOpen] = useState(false)
  const [localChapterConsent, setChapterConsent] = useState(false)
  const chapterConsent = permissions.ready && !permissions.error && (permissions.managed ? permissions.services : localChapterConsent)
  const [chapterDuration, setChapterDuration] = useState(10)
  const [localChapterRomanceConfirmed, setChapterRomanceConfirmed] = useState(false)
  const chapterRomanceConfirmed = permissions.managed ? permissions.romance : localChapterRomanceConfirmed
  useEffect(() => {
    setAiConsent(false)
    setChapterConsent(false)
    setRomanceConfirmed(false)
    setChapterRomanceConfirmed(false)
  }, [permissions.accountId])
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
      setChapterFormOpen(new URLSearchParams(window.location?.search || '').get('continue') === '1')
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
    setChapterFormOpen(false)
    setChapterConsent(false)
    setChapterRomanceConfirmed(false)
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
  const legacyEnding = Boolean(story?.generation === 'ai' && !story.journey && story.currentStep === story.scenes.length - 1)
  const sceneQuestion = legacyEnding ? '' : scene?.question.trim().replace(/\s+/g, ' ') || ''
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

  const finished = Boolean(story && (story.journey ? ['concluded', 'exhausted'].includes(story.journey.status)
    : story.responses.length >= story.scenes.length || (story.generation === 'ai' && story.currentStep === story.scenes.length - 1)))
  const recoveringEnding = story?.journey?.status === 'exhausted'
  const recoveryCopy = chapterRecoveryCopy(interfaceLanguage)
  const readyForClosing = Boolean(story?.journey && story.journey.status !== 'concluded' &&
    story.journey.revision >= story.journey.maxTurns - 1 &&
    story.journey.revision < story.journey.maxTurns + JOURNEY_ENDING_RECOVERY_ATTEMPTS)
  const writeClosingScene = async () => {
    if (!story?.journey || !readyForClosing || archiveReading || requestLock.current) return
    if (!reconciled || story.journey.pending) {
      setStoryError('Your saved progress is being checked before writing the closing scene.')
      return
    }
    if (!hasExplicitConsent(aiConsent)) {
      setStoryError('Review Story details and AI permission before asking Muse to write the closing scene.')
      return
    }
    requestLock.current = true
    setIsGenerating(true); setStoryError('')
    stopSpeaking(); interaction.cancelRecording()
    try {
      setReconciled(false)
      await requestJourney({
        action: 'conclude', id: story.id, capability: story.journey.capability,
        revision: story.journey.revision, requestId: crypto.randomUUID(), consentVersion: MUSE_AI_CONSENT_VERSION
      })
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : 'Could not write the closing scene. Any saved scenes are kept; no automatic retry was made.')
    } finally {
      requestLock.current = false
      setIsGenerating(false)
    }
  }
  const continueChapter = async () => {
    if (!story?.journey || story.journey.status !== 'concluded' || archiveReading || requestLock.current || preparation) return
    if (!hasExplicitConsent(chapterConsent)) {
      setStoryError('Confirm AI processing and the new chapter allowance before continuing.')
      return
    }
    try { requireRomanceConfirmation(story.romance, chapterRomanceConfirmed) } catch (error) {
      setStoryError(error instanceof Error ? error.message : 'Confirm the romance boundaries before continuing.')
      return
    }
    requestLock.current = true
    setIsGenerating(true); setStoryError(''); setReconciliationBlocked(false)
    stopSpeaking(); interaction.cancelRecording()
    try {
      const saved = {
        id: crypto.randomUUID(),
        capability: Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
      }
      window.localStorage.setItem(PREPARATION_KEY, JSON.stringify(saved))
      setPreparation(saved)
      await requestJourney({
        action: 'continue', ...saved, sourceId: story.id, sourceCapability: story.journey.capability,
        duration: chapterDuration, consentVersion: MUSE_AI_CONSENT_VERSION,
        ...(story.romance ? { romanceConfirmed: chapterRomanceConfirmed } : {})
      })
      setResponseDraft('')
      setAiConsent(true)
      setChapterConsent(false)
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : 'Could not start the next chapter. Your finished chapter is kept.')
    } finally {
      requestLock.current = false
      setIsGenerating(false)
    }
  }
  const openPreviousChapter = () => {
    if (!story?.chapter) return
    stopSpeaking()
    try {
      const parentId = story.chapter.parentId
      const result = loadStoryLibrary()
      if (result.error) throw new Error(result.error)
      const previous = result.library.entries.find(entry => entry.kind === 'personal' && entry.id === parentId)
      if (!previous) throw new Error('The previous chapter is not in this browser. Sync account stories in My stories to restore it.')
      selectPersonalStory(previous.id)
      window.location.assign('/story?read=1')
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : 'Could not open the previous chapter.')
    }
  }

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
  const pendingListen = useRef('')
  useEffect(() => { setStoryMode(null); pendingListen.current = '' }, [story?.id, story?.currentStep, archiveReading, rereading])
  useEffect(() => {
    if (!pendingListen.current || !narrator.cloudConsent || storyMode !== 'listen') return
    const text = pendingListen.current
    pendingListen.current = ''
    void narrator.speak(text, undefined, { autoPlay: true })
  }, [narrator.cloudConsent, storyMode])
  const scenePosition = narrator.activeText === narrationText ? narrator.textPosition : -1
  const changeStoryMode = (mode: StoryMode) => {
    narrator.stop(); stopRecording(); setStoryMode(mode)
    pendingListen.current = ''
    if (mode === 'listen') {
      const text = archiveReading || rereading ? `${story?.scenes[0].title}. ${story?.scenes[0].body}` : narrationText
      if (narrator.provider !== 'browser' && !narrator.cloudConsent) { pendingListen.current = text; return }
      void narrator.speak(text, undefined, { autoPlay: true })
    }
  }
  const savedScenes = story ? <div lang={story.language} dir={story.language ? storyLanguage(story.language).dir : undefined}>
    {story.scenes.map((savedScene, index) => {
      const text = `${savedScene.title}. ${savedScene.body}`
      const active = storyMode === 'listen' && narrator.activeText === text && (narrator.speaking || narrator.paused)
      return <article key={index} className="atelier-card">
        <h3><StoryPassage mode={storyMode} text={savedScene.title} narrationText={narrator.activeText} position={narrator.textPosition} active={active} /></h3>
        <p style={{ whiteSpace: 'pre-wrap' }}><StoryPassage mode={storyMode} text={savedScene.body} narrationText={narrator.activeText} position={narrator.textPosition} active={active} /></p>
        {storyMode === 'listen' ? <NarrationButton narrator={narrator} text={text} beforeSpeak={stopRecording} showCloudConsent={false} /> : null}
      </article>
    })}
  </div> : null

  return (
    <>
      <Head><title>{story ? `Muse - ${story.title}` : `Muse - ${pageText('personalStoryTitle', interfaceLanguage)}`}</title><meta name="description" content={story ? story.title : pageText('personalStoryMoodSubtitle', interfaceLanguage)} /></Head>
      <main className="atelier-page" lang={interfaceLanguage} dir={storyLanguage(interfaceLanguage).dir}>
        <div className="atelier-shell atelier-shell--narrow">
          {storyError ? <p role="alert" style={{ color: '#a14329', background: '#f9e7df', borderRadius: 10, padding: '0.8rem 1rem' }}>{storyError}{storyError.includes('Visit /billing') ? <> <Link href="/billing">See Muse Plus benefits and subscribe</Link>.</> : null}</p> : null}
          {storyNotice ? <p role="status">{storyNotice}</p> : null}
          {draftError ? <p role="alert">{draftError}</p> : null}
          {draftNotice && (!story || responseDraft) ? <p role="status">{draftNotice}</p> : null}
          {interaction.error ? <p role="alert">{interaction.error}</p> : null}
          <p><Link href={archiveReading ? '/library' : '/my-stories'}>{archiveReading ? flow('backArchive') : flow('backMyStories')}</Link></p>
          {!story ? <p>{flow('accountRequired')} <Link href="/account">{interfaceText('settingsTitle', interfaceLanguage)}</Link></p> : null}
          {preparation || story?.journey ? <div style={{ margin: '1rem 0' }}>
            {reconciliationBlocked ? <p role="status">{flow('sessionRestoreFailed')}</p>
              : !reconciled || story?.journey?.pending ? <p role="status">{flow('checkingProgress')}</p> : null}
            {preparation ? <p><button disabled={isGenerating} onClick={abandonPreparation}>{flow('abandonPreparation')}</button></p> : null}
          </div> : null}
          {!story ? (
            <section ref={creationSection} tabIndex={-1} aria-labelledby="creation-title">
              <p className="atelier-eyebrow">{pageText('personalStoryEyebrow', interfaceLanguage)}</p>
              <h1 id="creation-title" className="atelier-title">{pageText('personalStoryTitle', interfaceLanguage)}</h1>
              {creationStep === 0 ? <p className="atelier-subtitle">{pageText('personalStoryMoodSubtitle', interfaceLanguage)}</p> : null}
              <ol className="atelier-progress" aria-label={flow('creationSteps')}>
                {[pageText('chooseMood', interfaceLanguage), pageText('makeItYours', interfaceLanguage), pageText('reviewAndCreate', interfaceLanguage)].map((label, index) => <li key={label} aria-current={creationStep === index ? 'step' : undefined}>{index + 1}. {label}</li>)}
              </ol>
              <fieldset hidden={creationStep !== 0} disabled={creationStep !== 0 || isGenerating || Boolean(preparation)} style={{ border: 0, margin: 0, padding: 0 }}>
              <legend className="atelier-eyebrow">{pageText('chooseMood', interfaceLanguage)}</legend>
              <div data-responsive-grid="moods" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem', marginTop: '1rem' }}>
                {moods.map((mood) => <button key={mood.key} disabled={isGenerating || Boolean(preparation)} aria-pressed={selectedMood === mood.key} onClick={() => { setSelectedMood(mood.key); setAiConsent(false) }} style={{ textAlign: 'left', padding: '0.8rem', borderRadius: 16, border: selectedMood === mood.key ? '2px solid #2d2926' : '1px solid #d9cfc5', background: selectedMood === mood.key ? '#fffaf6' : 'transparent', cursor: 'pointer', color: '#2d2926' }}><strong>{moodTitle(mood.key)}</strong><span style={{ display: 'block', fontSize: '0.9rem' }}>{moodDescription(mood.key)}</span></button>)}
              </div>
              <RomanceOptions value={romance} onChange={value => { setRomance(value); setAiConsent(false) }} confirmed={romanceConfirmed} onConfirm={setRomanceConfirmed} disabled={isGenerating || Boolean(preparation)} language={interfaceLanguage} />
              </fieldset>
              <fieldset hidden={creationStep !== 1} disabled={creationStep !== 1 || isGenerating || Boolean(preparation)} className="atelier-card" style={{ margin: 0 }}>
              <legend>{flow('storyPace')}</legend>
              <div className="atelier-form-grid">
              <label style={{ display: 'block', marginTop: '1rem' }}>{flow('duration')}
                <select aria-label={flow('duration')} value={duration} disabled={isGenerating || Boolean(preparation)} onChange={event => { setDuration(Number(event.target.value)); setAiConsent(false) }}>
                  {[5, 10, 15, 20].map(minutes => <option key={minutes} value={minutes}>{minutes} {flow('minutes')}</option>)}
                </select>
              </label>
              <label style={{ display: 'block', marginTop: '1rem' }}>{pageText('createStoryLanguage', interfaceLanguage)}
                <select aria-label={pageText('createStoryLanguage', interfaceLanguage)} value={language} disabled={isGenerating || Boolean(preparation)} onChange={event => { setLanguage(event.target.value as StoryLanguageCode); setAiConsent(false) }}>
                  {STORY_LANGUAGES.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
                </select>
              </label>
              </div>
              <p className="atelier-note">{flow('storyLanguageNote')}</p>
              <label style={{ display: 'block', marginTop: '1rem' }}>{flow('interaction')}
                <select aria-label={flow('interaction')} value={choiceMode} disabled={isGenerating || Boolean(preparation)} onChange={event => { setChoiceMode(event.target.value as StoryChoiceMode); setAiConsent(false) }}>
                  <option value="free">{flow('freeInput')}</option>
                  <option value="suggested">{flow('suggestedInput')}</option>
                </select>
              </label>
              <label style={{ display: 'block', maxWidth: 700, marginTop: '1rem', fontWeight: 700 }}>{flow('need')}
                <textarea value={need} onChange={(event) => { setNeed(event.target.value); setAiConsent(false) }} maxLength={1000} disabled={isGenerating} rows={3} placeholder={flow('needPlaceholder')} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '0.5rem', padding: '0.8rem', font: 'inherit', lineHeight: 1.5, resize: 'vertical' }} />
              </label>
              <details style={{ marginTop: '1rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{flow('personalTouches')}</summary>
                <p>{flow('touchesHelp')}</p>
                <label>{flow('memoryQuestion')}
                  <textarea aria-label={flow('memoryQuestion')} value={profileDraft} onFocus={() => interaction.cancelRecording()} onChange={event => { interaction.cancelRecording(); setProfileDraft(event.target.value) }} maxLength={4000} rows={3} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.9rem', font: 'inherit' }} />
                </label>
                <DictationButton label={`${flow('dictate')} ${flow('personalTouches')}`} stopLabel={flow('stopUseText')} stoppingLabel={flow('finishing')} recording={interaction.recordingTarget === 'profile' || interaction.stoppingTarget === 'profile'} stopping={interaction.stoppingTarget === 'profile'} disabled={creationStep !== 1 || isGenerating || Boolean(preparation) || Boolean(interaction.stoppingTarget)}
                  onStart={() => interaction.dictate('profile', value => setProfileDraft(value.slice(0, 4000)))}
                  onStop={() => stopRecording('profile')} />
                <button type="button" disabled={!profileDraft.trim() || isGenerating} onClick={savePersonalTouches}>{flow('saveTouches')}</button>
                {profileReady ? <label style={{ display: 'block', marginTop: '0.75rem' }}><input type="checkbox" checked={useProfile} disabled={isGenerating} onChange={(event) => { setUseProfile(event.target.checked); setAiConsent(false) }} /> {flow('includeMemories')}</label> : null}
              </details>
              </fieldset>
              <fieldset hidden={creationStep !== 2} disabled={creationStep !== 2 || isGenerating || Boolean(preparation)} className="atelier-card" style={{ margin: 0 }}>
              <legend>{flow('lastLook')}</legend>
              <p><strong>{moodTitle(selectedMood)}</strong> · {flow('aboutDuration')} {duration} {flow('minutes')} · {storyLanguage(language).label}</p>
              <p>{choiceMode === 'suggested' ? flow('suggestedReview') : flow('freeReview')} {useProfile && profileReady ? flow('memoryIncluded') : flow('memoryExcluded')}</p>
              {need ? <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{need}</p> : null}
              {romance ? <p>{romanceCopy(interfaceLanguage).title(romance)}. <button type="button" onClick={() => moveCreationStep(0)}>{flow('changeTheme')}</button></p> : null}
              <ExplicitConsent checked={aiConsent} onChange={setAiConsent}>
                {flow('aiConsent')} {flow('attemptNote')}
              </ExplicitConsent>
              {narrator.provider !== 'browser' ? <ExplicitConsent checked={narrator.cloudConsent} onChange={narrator.setCloudConsent}>
                Enable optional narration: send story text to {narrator.provider === 'google' ? 'Google Cloud' : 'ElevenLabs'} when I choose Listen. New recordings use the narration allowance; saved recordings are reused. <Link href="/privacy">Privacy</Link>
              </ExplicitConsent> : null}
              <details style={{ marginTop: '1rem' }}>
                <summary>Privacy and limits</summary>
                <p>{recoveryCopy.help}</p>
                <p>Your creator code is never saved. Private story access stays in this browser. Browser narration is free; narration and dictation may use online speech services.</p>
              </details>
              <button className="atelier-button" onClick={begin} disabled={isGenerating || Boolean(preparation)} style={{ marginTop: '1rem' }}>{isGenerating ? flow('creatingStory') : flow('createStory')}</button>
              </fieldset>
              <div className="atelier-actions">
                {creationStep > 0 ? <button className="atelier-secondary" disabled={isGenerating || Boolean(preparation)} onClick={() => moveCreationStep(creationStep - 1)}>{flow('back')}</button> : null}
                {creationStep < 2 ? <button className="atelier-button" disabled={isGenerating || Boolean(preparation)} onClick={() => moveCreationStep(creationStep + 1)}>{flow('continue')}</button> : null}
              </div>
            </section>
          ) : (
            <section className="atelier-reading">
              <h1 className="story-reading-title" lang={story.language} dir={story.language ? storyLanguage(story.language).dir : undefined}>{story.title}</h1>
              {story.journey ? <p>{chapterLabel(story.chapter?.number ?? 1)}
                {story.chapter?.parentId ? <> <button type="button" onClick={openPreviousChapter}>{flow('readPreviousChapter')}</button></> : null}</p> : story.chapter ? <p>{chapterLabel(story.chapter.number)} <button type="button" onClick={openPreviousChapter}>{flow('readPreviousChapter')}</button></p> : null}
              <StoryModeControl mode={storyMode} onChange={changeStoryMode} copy={interfaceCopy} language={interfaceLanguage} direction={storyLanguage(interfaceLanguage).dir} />
              {storyMode === 'listen' ? <details>
                <summary>{flow('audioSettings')}</summary>
                <NarrationControls narrator={narrator} beforeSpeak={stopRecording} />
              </details> : null}
              <details className="story-options"><summary>{flow('storyDetails')}</summary>
              <p>{story.description}</p>
              {story.romance ? <p>{romanceCopy(interfaceLanguage).title(story.romance)}</p> : null}
              <p>{story.journey
                ? formatFlow('journeyProgress', {
                  used: story.journey.revision, total: story.journey.maxTurns,
                  status: flow(journeyStatusLabels[story.journey.status])
                })
                : formatFlow('sceneProgress', { current: story.currentStep + 1, total: story.scenes.length })}</p>
              {(story.journey || (story.generation === 'ai' && story.currentStep < story.scenes.length - 1)) && !finished && !archiveReading ? (
                <ExplicitConsent checked={aiConsent} onChange={setAiConsent}>
                  {flow('aiConsent')} {flow('attemptNote')}
                </ExplicitConsent>
              ) : null}
              </details>
              {storyMode === 'listen' && narrator.provider !== 'browser' && !narrator.cloudConsent ? <details open style={{ marginBottom: '1rem' }}>
                <summary>{interfaceLanguage === 'en-US' ? 'Enable narration' : interfaceCopy.listenScene}</summary>
                <p>{interfaceCopy.listenDescription}</p>
                <ExplicitConsent checked={narrator.cloudConsent} onChange={narrator.setCloudConsent}>
                  Send story text to {narrator.provider === 'google' ? 'Google Cloud' : 'ElevenLabs'} when I choose Listen. New recordings use the narration allowance; saved recordings are reused. <Link href="/privacy">Privacy</Link>
                </ExplicitConsent>
              </details> : null}
              {!archiveReading && !rereading ? <article lang={story.language} dir={story.language ? storyLanguage(story.language).dir : undefined} style={{ maxWidth: 760, background: '#fffaf6', border: '1px solid #d9cfc5', borderRadius: 20, padding: '1.5rem' }}>
                <h2 style={{ margin: '0.5rem 0 1rem' }}>{storyMode !== null ? <ReadAlongText text={sceneTitle} startAt={0} position={scenePosition} active={storyMode === 'listen'} /> : null}</h2>
                <p className="atelier-prose">{storyMode !== null ? <ReadAlongText text={sceneBody} startAt={sceneBodyStart} position={scenePosition} active={storyMode === 'listen'} /> : null}</p>
                {storyMode === 'listen' ? <>
                {narrator.activeText === narrationText ? <NarrationButton narrator={narrator} text={narrationText} label={interfaceCopy.listenScene} beforeSpeak={stopRecording} showCloudConsent={false} /> : null}
                {narrator.ambientKind && narrator.ambientKind !== 'none' ? <p role="status">{soundscapeLabel(narrator.ambientKind)}</p> : null}
                {narrator.ambientNotice ? <p role="alert">{narrator.ambientNotice} <button type="button" onClick={() => narrator.startAmbientFor(narrationText)}>{flow('retryAmbient')}</button></p> : null}
                {narrator.error ? <p role="alert">{narrator.error}</p> : null}
                </> : null}
                {story.journey?.state ? <details><summary>{flow('journeyMemory')}</summary>{(['inventory', 'discoveries', 'relationships'] as const).map(key => <p key={key}>{flow(key)}: {story.journey!.state![key].join(', ') || flow('noneYet')}</p>)}<p>{story.journey.state.progress}</p></details> : null}
                {readyForClosing && !recoveringEnding && !archiveReading ? <section aria-label={flow('chapterClosingScene')}>
                  <h3>{flow('writeEnding')}</h3>
                  <button type="button" className="atelier-button" disabled={isGenerating || !reconciled || Boolean(story.journey?.pending)} onClick={() => void writeClosingScene()}>
                    {isGenerating ? flow('writing') : flow('writeEnding')}
                  </button>
                </section> : !finished && !archiveReading ? <>
                <h3 style={{ marginTop: '2rem' }}>{story.journey && !sceneQuestion ? flow('doOrSay') : storyMode !== null ? <ReadAlongText text={sceneQuestion} startAt={sceneQuestionStart} position={scenePosition} active={storyMode === 'listen'} /> : null}</h3>
                {story.journey?.choiceMode === 'suggested' ? <>
                  <p>{flow('eachChoiceUsesAttempt')}</p>
                  <div role="group" aria-label={flow('suggestedActions')} style={{ display: 'grid', gap: '0.7rem' }}>
                    {story.journey.choices?.map(choice => <button key={choice} disabled={isGenerating || !reconciled || story.journey?.pending} onClick={() => void choose(choice)} style={{ textAlign: 'left', padding: '0.9rem 1rem', border: '1px solid #d9cfc5', borderRadius: 12, background: '#f7f3ed', color: '#2d2926', font: 'inherit', cursor: 'pointer' }}>{choice}</button>)}
                  </div>
                  {!story.journey.choices?.length ? <p>{flow('actionsLoadAutomatically')}</p> : null}
                </> : <>
                <label>{flow('responseLabel')}
                <textarea aria-label={flow('responseLabel')} value={responseDraft} onFocus={() => interaction.cancelRecording()} onChange={(event) => { interaction.cancelRecording(); setResponseDraft(event.target.value) }} maxLength={story.journey ? 800 : 600} disabled={finished} rows={3} placeholder={flow('responsePlaceholder')} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.9rem', font: 'inherit', lineHeight: 1.5, resize: 'vertical' }} />
                </label>
                <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
                  <button onClick={submitResponse} disabled={!responseDraft.trim() || isGenerating || finished || Boolean(story.journey && (!reconciled || story.journey.pending))} style={{ padding: '0.75rem 1rem', border: 0, borderRadius: 999, background: '#2d2926', color: '#fffaf6', cursor: responseDraft.trim() ? 'pointer' : 'not-allowed' }}>{isGenerating ? flow('writing') : flow('continueResponse')}</button>
                  <DictationButton label={interfaceCopy.dictateAnswer} stopLabel={interfaceCopy.stopDictation} stoppingLabel={flow('finishing')} recording={isRecording || interaction.stoppingTarget === 'response'} stopping={interaction.stoppingTarget === 'response'} onStart={startDictation} onStop={() => stopRecording('response')} disabled={isGenerating || finished || Boolean(interaction.stoppingTarget) || Boolean(story.journey && (!reconciled || story.journey.pending))} style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: isRecording ? '#a14329' : undefined, color: isRecording ? '#fffaf6' : undefined }} />
                </div>
                {isRecording ? <p role="status">{interaction.ready ? flow('listen') : flow('startingMic')}</p> : null}
                {isRecording ? <button type="button" onClick={() => interaction.cancelRecording()}>{flow('stopAndType')}</button> : null}
                </>}
                {!story.journey ? <>
                <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.9rem', opacity: 0.65 }}>{flow('legacyDirection')} {flow('legacyDirectionNote')}</p>
                <div style={{ display: 'grid', gap: '0.7rem' }}>{scene?.choices.map((choice) => <button key={choice} disabled={isGenerating || finished} onClick={() => choose(choice)} style={{ textAlign: 'left', padding: '0.9rem 1rem', border: '1px solid #d9cfc5', borderRadius: 12, background: '#f7f3ed', color: '#2d2926', cursor: 'pointer', font: 'inherit' }}>{choice} →</button>)}</div>
                </> : null}
                </> : null}
              </article> : null}
              {archiveReading ? <section aria-label={flow('archivedStory')}>
                <h2>{flow('savedScenes')}</h2>
                {savedScenes}
                {storyMode === 'listen' && narrator.error ? <p role="alert">{narrator.error}</p> : null}
                {storyMode === 'listen' && narrator.ambientNotice ? <p role="alert">{narrator.ambientNotice} <button type="button" onClick={() => narrator.startAmbientFor(narrator.activeText)}>{flow('retryAmbient')}</button></p> : null}
                {storyMode === 'listen' && narrator.ambientKind && narrator.ambientKind !== 'none' ? <p role="status">{soundscapeLabel(narrator.ambientKind)}</p> : null}
                <p><Link href="/my-stories">{flow('backMyStoriesLink')}</Link></p>
              </section> : null}
              {finished && !archiveReading ? <section aria-label="Your saved story" style={{ marginTop: '1rem', padding: '1rem 1.25rem', borderRadius: 14, background: '#e8eee3' }}>
                <h2>{story.journey?.status === 'exhausted' ? `${chapterLabel(story.chapter?.number ?? 1)} · ${flow('savedScenes')}`
                  : story.journey ? `${chapterLabel(story.chapter?.number ?? 1)} · ${flow('storyComplete')}` : pageText('storyCompleted', interfaceLanguage)}</h2>
                <p>{story.journey?.status === 'exhausted' ? recoveryCopy.exhausted : flow('completedStoryNote')}</p>
                {recoveringEnding && !archiveReading ? <section aria-label={recoveryCopy.recover}>
                  <p>{readyForClosing ? recoveryCopy.help : recoveryCopy.limit}</p>
                  {readyForClosing ? <>
                    <ExplicitConsent checked={aiConsent} onChange={setAiConsent}>{recoveryCopy.consent}</ExplicitConsent>
                    <button type="button" disabled={!aiConsent || isGenerating || !reconciled || Boolean(story.journey?.pending)}
                      onClick={() => void writeClosingScene()}>{isGenerating ? flow('writing') : recoveryCopy.recover}</button>
                  </> : null}
                </section> : null}
                <button type="button" onClick={() => { stopSpeaking(); setRereading(value => !value) }}>{rereading ? flow('closeReading') : flow('readAgain')}</button>
                {story.journey?.status === 'concluded' ? <section aria-label="Continue with a new chapter">
                  <button type="button" disabled={isGenerating || Boolean(preparation)} onClick={() => {
                    setChapterFormOpen(value => !value); setChapterConsent(false); setChapterRomanceConfirmed(false)
                    setChapterDuration(story.journey?.duration ?? 10)
                  }}>{chapterFormOpen ? flow('cancel') : flow('continueChapter').replace('{number}', String((story.chapter?.number ?? 1) + 1))}</button>
                  {chapterFormOpen ? <div>
                    <p>{flow('nextChapterInfo')}</p>
                    <label>{flow('duration')}<select aria-label={flow('duration')} value={chapterDuration} disabled={isGenerating} onChange={event => { setChapterDuration(Number(event.target.value)); setChapterConsent(false) }}>
                      {[5, 10, 15, 20].map(minutes => <option key={minutes} value={minutes}>{formatFlow('chapterDurationOption', { minutes, responses: minutes * 3 / 5 })}</option>)}
                    </select></label>
                    <ExplicitConsent checked={chapterConsent} onChange={setChapterConsent}>
                      {flow('chapterConsentText')}
                    </ExplicitConsent>
                    {story.romance && !permissions.managed ? <label><input type="checkbox" checked={chapterRomanceConfirmed} disabled={isGenerating} onChange={event => setChapterRomanceConfirmed(event.target.checked)} />{romanceCopy(interfaceLanguage).creatorConfirmation}</label> : null}
                    {story.romance && permissions.managed && !permissions.romance ? <p role="alert"><a href="/account">{registrationCopy(interfaceLanguage).settings}</a></p> : null}
                    <button type="button" disabled={!chapterConsent || isGenerating || Boolean(preparation) || Boolean(story.romance && !chapterRomanceConfirmed)} onClick={() => void continueChapter()}>{isGenerating ? flow('startingChapter') : flow('confirmStartChapter')}</button>
                  </div> : null}
                </section> : null}
                {rereading ? savedScenes : null}
                {rereading && storyMode === 'listen' && narrator.error ? <p role="alert">{narrator.error}</p> : null}
                {rereading && storyMode === 'listen' && narrator.ambientNotice ? <p role="alert">{narrator.ambientNotice} <button type="button" onClick={() => narrator.startAmbientFor(narrator.activeText)}>{flow('retryAmbient')}</button></p> : null}
                <StoryLifeBridge
                  key={`${story.id}:${story.chapter?.number ?? 1}`}
                  story={story}
                  archiveReading={archiveReading}
                  language={interfaceLanguage}
                />
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

import Head from 'next/head'
import Link from 'next/link'
import SiteNavigation from '../components/SiteNavigation'
import PageIllustration from '../components/PageIllustration'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { SHARED_STORY_DURATIONS, type SharedStoryBrief, type SharedStoryPlayer } from '../lib/sharedStory'
import { latestCreatorStory, loadStoryLibrary, removeLibraryEntry, saveLibraryCreatorStory, type CreatorStory } from '../lib/storyLibrary'
import { useStoryInteraction } from '../lib/useStoryInteraction'
import MicrophoneCheck from '../components/MicrophoneCheck'
import DictationButton from '../components/DictationButton'
import { recipientShareDetails, sharedStoryPreviewText } from '../lib/sharedStorySharing'
import { useNarration } from '../lib/useNarration'
import NarrationControls, { NarrationButton } from '../components/NarrationControls'
import StoryModeControl, { type StoryMode } from '../components/StoryModeControl'
import StoryPassage from '../components/StoryPassage'
import SharedStoryReveal, { type RevealMedia } from '../components/SharedStoryReveal'
import ExplicitConsent from '../components/ExplicitConsent'
import { useAccountPermissions } from '../lib/useAccountPermissions'
import GiftVoiceRecorder from '../components/GiftVoiceRecorder'
import ShareGiftStory from '../components/ShareGiftStory'
import GiftStoryPreview from '../components/GiftStoryPreview'
import { storyHasAccess } from '../lib/storyRetention'
import StudioNarration, { type StudioSceneStatus } from '../components/StudioNarration'
import RomanceOptions from '../components/RomanceOptions'
import { romanceCopy, requireRomanceConfirmation, type StoryRomance } from '../lib/storyRomance'
import { registrationCopy } from '../lib/registrationCopy'
import { sharedCreationCopy } from '../lib/sharedCreationCopy'
import { parseSuggestedChoices } from '../lib/freeformStory'
import { STORY_LANGUAGES, storyLanguage, recipientCopy, type StoryLanguageCode } from '../lib/storyLanguage'
import { parseSharedStoryTranslation, type SharedStoryTranslation } from '../lib/sharedStoryTranslation'
import { GIFT_DRAFT_KEY, GIFT_OCCASIONS, parseGiftDraft, type GiftDraft, type GiftOccasion } from '../lib/storyGift'
import { readDraft, removeDraft, writeDraft } from '../lib/browserDrafts'
import { loadStoryPreferences, saveStoryPreferences } from '../lib/storyPreferences'
import { loadProfileDisplayName } from '../lib/profilePreferences'
import { useInterfaceLanguage } from '../lib/interfaceLanguage'
import { giftFormText, interfacePageText as pageText, type GiftFormCopyKey } from '../lib/interfacePages'
import { interfaceFlowText } from '../lib/interfaceFlow'
import { hasExplicitConsent, MUSE_AI_CONSENT_VERSION } from '../lib/legalContact'
import {
  formatMediaSize, parseMediaDeclaration, validateVoiceBytes, SHARED_MEDIA_ACCEPT, SHARED_MEDIA_ATTEMPTS_PER_STORY, SHARED_MEDIA_PHOTO_MAX_BYTES, SHARED_MEDIA_VIDEO_MAX_BYTES,
  type SharedMediaKind, type SharedMediaSummary
} from '../lib/sharedStoryMedia'
import { accountAuthorization, accountFetch } from '../lib/accountClient'

type PlayerResponse = { player: SharedStoryPlayer; sessionToken: string }
type RomanceNotice = { romance: StoryRomance; language?: SharedStoryBrief['language'] }
type OpenResponse = PlayerResponse | { romanceNotice: RomanceNotice } | { requiresDisplayName: true; sessionToken: string }
type MediaState = { media: SharedMediaSummary | null; mediaRequired: boolean }
type UploadTarget = { method: 'PUT'; url: string; headers: Record<string, string> }
type UploadState = { phase: 'idle' | 'uploading' | 'failed'; progress: number; error?: string }
type VoiceSummary = { mime: string; size: number }
type GiftReply = { message: string; createdAt: string }
type GiftState = { voice?: VoiceSummary | null; replies?: GiftReply[] }
type StudioResponse = { studio: {
  available: boolean
  reason: null | 'disabled' | 'configuration-required' | 'prepared-scenes-only'
  scenes: { sceneIndex: number; status: 'pending' | 'ready' | 'failed' }[]
} }

function studioSceneStatus(result: StudioResponse, sceneIndex: number): StudioSceneStatus {
  const scene = result.studio.scenes.find(item => item.sceneIndex === sceneIndex)
  const blocked = scene?.status === 'pending' || scene?.status === 'failed'
  return {
    enabled: result.studio.available, ready: scene?.status === 'ready', blocked,
    ...(blocked ? { message: scene.status === 'pending'
      ? 'This scene is being prepared. Check again later; do not submit another paid attempt.'
      : 'This preparation failed. Its budget reservation remains charged; automatic retries are blocked.' }
      : !result.studio.available && scene?.status !== 'ready' ? { message: result.studio.reason === 'prepared-scenes-only'
        ? 'Studio supports prepared stories only, not live AI turns.'
        : 'Studio generation is disabled until credentials and an explicit character budget are configured.' } : {})
  }
}

const fieldStyle: CSSProperties = { display: 'block', width: '100%', marginTop: '0.5rem', boxSizing: 'border-box' }
const cardStyle: CSSProperties = { padding: 'clamp(1rem, 4vw, 1.75rem)', border: '1px solid #e4dcd4', borderRadius: 20, background: '#fffdf9', marginBottom: '1rem' }
const buttonStyle: CSSProperties = { padding: '0.8rem 1.1rem', minHeight: 48, borderRadius: 999, border: '1px solid #d8cdd6', background: 'transparent', color: '#202c42', cursor: 'pointer', fontSize: '1rem' }
const primaryStyle: CSSProperties = { ...buttonStyle, background: '#202c42', borderColor: '#202c42', color: '#f7f3ed' }
const DEFAULT_NARRATION = 'A warm, playful mystery told in the second person, with gentle suspense.'
const blankBrief: SharedStoryBrief = { creatorName: '', recipientName: '', narration: DEFAULT_NARRATION, setting: '', recipientHints: '', goal: '', solution: '', puzzleDifficulty: 'balanced', answerType: 'phrase', answerInstruction: '', message: '', durationMinutes: 5, language: 'en-US', assistanceHints: [], alternativeAnswers: [] }
const idleUpload: UploadState = { phase: 'idle', progress: 0 }
const mediaLabel = (kind: SharedMediaKind) => kind === 'video' ? 'video' : 'photo'
const hasGiftDraftWriting = (brief: SharedStoryBrief) =>
  [brief.creatorName, brief.recipientName, brief.setting, brief.solution, brief.message, brief.recipientHints, brief.gift?.dedication].some(value => value?.trim())
type AssistanceField = 'assistanceHints' | 'alternativeAnswers'
const assistanceLines = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
const giftOccasionLabels: Record<GiftOccasion, GiftFormCopyKey> = {
  birthday: 'birthday', anniversary: 'anniversary', surprise: 'surprise', 'just-because': 'justBecause'
}
type RecipientAnswerDraft = { revision: number; text: string }
type RecipientDraftState = { revision: number | null; answerKey: string; actionKey: string; answerWritable: boolean; actionWritable: boolean; ready: boolean }

function isGiftDraft(value: unknown): value is GiftDraft {
  parseGiftDraft(value)
  return true
}

function loadGiftDraft(): GiftDraft | null {
  return readDraft(GIFT_DRAFT_KEY, isGiftDraft)
}

function saveGiftDraft(draft: GiftDraft): void {
  writeDraft(GIFT_DRAFT_KEY, parseGiftDraft(draft))
}

function removeGiftDraft(): void {
  removeDraft(GIFT_DRAFT_KEY)
}

function isRecipientAnswerDraft(value: unknown): value is RecipientAnswerDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const draft = value as Record<string, unknown>
  return Object.keys(draft).sort().join() === 'revision,text' &&
    Number.isInteger(draft.revision) && Number(draft.revision) >= 0 &&
    typeof draft.text === 'string' && draft.text.length <= 800
}

function localizeRecipientPlayer(player: SharedStoryPlayer, translation: SharedStoryTranslation | null): SharedStoryPlayer {
  if (!translation) return player
  const sourceCopy = recipientCopy(player.language)
  const targetCopy = recipientCopy(translation.language)
  const sourceScene = translation.content.scenes[player.sceneIndex]
  const liveTurn = Boolean(player.adventure?.turn)
  return {
    ...player,
    language: translation.language,
    narrationLanguage: translation.language,
    title: translation.content.title,
    description: translation.content.description,
    ...(!liveTurn && sourceScene ? { scene: sourceScene } : {}),
    discoveries: liveTurn ? player.discoveries
      : player.discoveries.map((_, index) => translation.content.scenes[index] ?? player.discoveries[index]),
    ...(player.feedback === sourceCopy.feedbackSolved ? { feedback: targetCopy.feedbackSolved }
      : player.feedback === sourceCopy.feedbackWrong ? { feedback: targetCopy.feedbackWrong }
        : player.feedback === sourceCopy.feedbackSkipped ? { feedback: targetCopy.feedbackSkipped } : {})
  }
}

async function recipientAnswerDraftKey(token: string, kind: 'answer' | 'action', revision: number): Promise<string> {
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const storyId = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return `muse-shared-recipient-draft:${storyId}:${kind}:${revision}`
}

async function request<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await accountFetch('/api/shared-story', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Could not complete the story request.')
  return data as T
}

async function requestStudioAudio(body: Record<string, unknown>, signal: AbortSignal): Promise<Blob> {
  const response = await accountFetch('/api/shared-story', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal
  })
  if (!response.ok) {
    if ((response.headers.get('content-type') || '').includes('application/json')) {
      const data = await response.json()
      throw new Error(data.error || 'Studio audio is unavailable.')
    }
    throw new Error('Studio audio could not be loaded. Retry or read instead.')
  }
  return response.blob()
}

const allowedMediaUrl = (url: URL) => url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))

// Final media arrives either as a short-lived private signed URL (hosted) or as
// an authenticated same-origin byte stream (local), turned into a blob: URL.
async function requestMedia(body: Record<string, unknown>): Promise<{ url: string; blob: boolean }> {
  const response = await accountFetch('/api/shared-story', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  })
  if ((response.headers.get('content-type') || '').startsWith('application/json')) {
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Could not load the photo or video.')
    const url = new URL(String(data.media?.url || ''))
    if (!allowedMediaUrl(url)) throw new Error('The photo or video address is not secure.')
    return { url: url.toString(), blob: false }
  }
  if (!response.ok) throw new Error('Could not load the photo or video.')
  return { url: URL.createObjectURL(await response.blob()), blob: true }
}

// The account token is attached only to Muse's own upload route, never to storage hosts.
async function putFile(target: UploadTarget, file: File, onProgress: (percent: number) => void): Promise<void> {
  const authorization = await accountAuthorization()
  return new Promise((resolve, reject) => {
    const url = new URL(target.url, window.location.origin)
    const sameOrigin = url.origin === window.location.origin
    if (target.method !== 'PUT' || (!sameOrigin && !allowedMediaUrl(url))) {
      reject(new Error('The upload destination is not allowed.'))
      return
    }
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url.toString())
    for (const [name, value] of Object.entries(target.headers)) xhr.setRequestHeader(name, value)
    if (sameOrigin && authorization) xhr.setRequestHeader('Authorization', authorization)
    xhr.timeout = 10 * 60 * 1000
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)) }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      let message = ''
      try { message = sameOrigin ? JSON.parse(xhr.responseText).error : '' } catch { /* Storage errors are summarized below. */ }
      reject(new Error(message || `The storage service rejected the upload (${xhr.status}).`))
    }
    xhr.onerror = () => reject(new Error('The upload was interrupted. Check your connection and retry.'))
    xhr.ontimeout = () => reject(new Error('The upload took too long. Check your connection and retry.'))
    xhr.send(file)
  })
}

export default function SharedStoryPage() {
  const interfaceLanguage = useInterfaceLanguage()
  const flow = (key: Parameters<typeof interfaceFlowText>[0]) => interfaceFlowText(key, interfaceLanguage)
  const creation = sharedCreationCopy(interfaceLanguage)
  const interfaceCopy = recipientCopy(interfaceLanguage)
  const [brief, setBrief] = useState<SharedStoryBrief>(blankBrief)
  const [assistanceHintsText, setAssistanceHintsText] = useState('')
  const [alternativeAnswersText, setAlternativeAnswersText] = useState('')
  const [creator, setCreator] = useState<CreatorStory | null>(null)
  const [player, setPlayer] = useState<SharedStoryPlayer | null>(null)
  const [sourcePlayer, setSourcePlayer] = useState<SharedStoryPlayer | null>(null)
  const [readerLanguage, setReaderLanguage] = useState<StoryLanguageCode | null>(null)
  const [readerTranslation, setReaderTranslation] = useState<SharedStoryTranslation | null>(null)
  const [translationConsent, setTranslationConsent] = useState(false)
  const [playToken, setPlayToken] = useState('')
  const [sessionToken, setSessionToken] = useState('')
  const [guestNameRequired, setGuestNameRequired] = useState(false)
  const [guestDisplayName, setGuestDisplayName] = useState('')
  const [cooperativeSyncError, setCooperativeSyncError] = useState('')
  const [guess, setGuess] = useState('')
  const [actionText, setActionText] = useState('')
  const [recipientDraft, setRecipientDraft] = useState<RecipientDraftState>({
    revision: null, answerKey: '', actionKey: '', answerWritable: false, actionWritable: false, ready: false
  })
  const [recipientDraftError, setRecipientDraftError] = useState('')
  const recipientDraftRef = useRef(recipientDraft)
  const actionTextRef = useRef(actionText)
  const recipientTokenRef = useRef('')
  recipientDraftRef.current = recipientDraft
  actionTextRef.current = actionText
  const permissions = useAccountPermissions()
  const [localAiConsent, setAiConsent] = useState(false)
  const aiConsent = permissions.ready && !permissions.error && (permissions.managed ? permissions.services : localAiConsent)
  const [localRomanceConfirmed, setRomanceConfirmed] = useState(false)
  const romanceConfirmed = permissions.managed ? permissions.romance : localRomanceConfirmed
  const [romanceNotice, setRomanceNotice] = useState<RomanceNotice | null>(null)
  const [romanceAccepted, setRomanceAccepted] = useState(false)
  const [localRecipientConfirmation, setRecipientConfirmation] = useState(false)
  const recipientConfirmation = permissions.managed ? permissions.romance : localRecipientConfirmation
  const [romanceDeclined, setRomanceDeclined] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [origin, setOrigin] = useState('')
  const [tunnelAddress, setTunnelAddress] = useState('')
  const [publicOrigin, setPublicOrigin] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [upload, setUpload] = useState<UploadState>(idleUpload)
  const [ownerMedia, setOwnerMedia] = useState<SharedMediaSummary | null>(null)
  const [ownerPreview, setOwnerPreview] = useState<RevealMedia | null>(null)
  const [revealMedia, setRevealMedia] = useState<RevealMedia | null>(null)
  const [voiceFile, setVoiceFile] = useState<File | null>(null)
  const [ownerVoice, setOwnerVoice] = useState<VoiceSummary | null>(null)
  const [voiceUrl, setVoiceUrl] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [voiceUploading, setVoiceUploading] = useState(false)
  const [voiceRecording, setVoiceRecording] = useState(false)
  const [replies, setReplies] = useState<GiftReply[]>([])
  const [followUpReply, setFollowUpReply] = useState<GiftReply | null>(null)
  const [followUpDirection, setFollowUpDirection] = useState('')
  const [followUpGoal, setFollowUpGoal] = useState('')
  const [followUpSolution, setFollowUpSolution] = useState('')
  const [followUpMessage, setFollowUpMessage] = useState('')
  const [localFollowUpConsent, setFollowUpConsent] = useState(false)
  const followUpConsent = permissions.ready && !permissions.error && (permissions.managed ? permissions.services : localFollowUpConsent)
  const [localFollowUpRomanceConfirmed, setFollowUpRomanceConfirmed] = useState(false)
  const followUpRomanceConfirmed = permissions.managed ? permissions.romance : localFollowUpRomanceConfirmed
  useEffect(() => {
    setAiConsent(false)
    setFollowUpConsent(false)
    setRomanceConfirmed(false)
    setRecipientConfirmation(false)
    setFollowUpRomanceConfirmed(false)
  }, [permissions.accountId])
  const [replyText, setReplyText] = useState('')
  const [replySent, setReplySent] = useState(false)
  const [giftOpened, setGiftOpened] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<GiftDraft | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const [draftStatus, setDraftStatus] = useState('')
  const [draftUnreadable, setDraftUnreadable] = useState(false)
  const [preferencesError, setPreferencesError] = useState('')
  const [creatorStep, setCreatorStep] = useState(0)
  const giftDraftSnapshot = useRef({ brief, assistanceHintsText, alternativeAnswersText, draftReady, pendingDraft, draftUnreadable, loading, creator, playToken, busy })
  giftDraftSnapshot.current = { brief, assistanceHintsText, alternativeAnswersText, draftReady, pendingDraft, draftUnreadable, loading, creator, playToken, busy }
  const creatorForm = useRef<HTMLFormElement>(null)
  const storedVoiceAudio = useRef<HTMLAudioElement>(null)
  const studioAudio = useRef<HTMLAudioElement>(null)
  const [studioScene, setStudioScene] = useState(0)
  const [experience, setExperience] = useState<{ key: string; mode: StoryMode } | null>(null)
  const experienceKey = JSON.stringify([playToken, player?.sceneIndex, player?.adventure?.revision, player?.solved, player?.skipped, creator?.ownerToken, studioScene])
  const storyMode = experience?.key === experienceKey ? experience.mode : null
  const setStoryMode = (mode: StoryMode) => setExperience({ key: experienceKey, mode })
  const [studioPlayRequest, setStudioPlayRequest] = useState(0)
  const [studioReadAlong, setStudioReadAlong] = useState({ text: '', position: 0, active: false })
  const objectUrls = useRef<string[]>([])
  const lastMediaRefresh = useRef(0)
  const narrator = useNarration(player || creator?.content || {}, undefined, {
    progress: player?.adventure ? player.adventure.actionsUsed / 12
      : player ? player.sceneIndex / Math.max(1, player.sceneCount - 1) : 0,
    ending: player ? player.solved || player.skipped : undefined,
    sceneKey: player ? `${playToken}:${player.adventure?.revision ?? player.sceneIndex}:${player.solved}:${player.skipped}`
      : creator?.ownerToken || 'new'
  }, { browserOnly: true })
  const interaction = useStoryInteraction(() => { studioAudio.current?.pause(); narrator.stop() }, player?.language || creator?.brief.language || brief.language || 'en-US')
  const beforeStudio = () => { narrator.stop(); interaction.stopRecording(); storedVoiceAudio.current?.pause() }
  const beforeDeviceListen = () => {
    studioAudio.current?.pause()
    storedVoiceAudio.current?.pause()
    setStudioReadAlong({ text: '', position: 0, active: false })
    interaction.stopRecording()
  }
  useEffect(() => {
    studioAudio.current?.pause()
    setStudioReadAlong({ text: '', position: 0, active: false })
  }, [narrator.style, narrator.language, narrator.selectedVoice, narrator.immersive.soundscape, narrator.immersive.ambientVolume, narrator.immersive.voiceVolume, narrator.immersive.expressive])
  const changeStoryMode = (mode: StoryMode) => {
    studioAudio.current?.pause()
    storedVoiceAudio.current?.pause()
    narrator.stop()
    interaction.stopRecording()
    setStudioReadAlong({ text: '', position: 0, active: false })
    setStoryMode(mode)
    if (mode === 'listen') {
      if (player?.solved || player?.skipped) {
        const endingText = player.endingMode === 'automatic'
          ? `${player.scene.title}. ${player.scene.body}${player.message ? `\n\n${player.message}` : ''}`
          : player.message
        if (endingText) void narrator.speak(endingText, { progress: 1, ending: true }, { autoPlay: true })
      } else if (player?.adventure) {
        void narrator.speak(player.adventure.turn?.narration || `${player.scene.body} ${player.scene.clue}`, undefined, { autoPlay: true })
      } else if (creator?.brief.adventure) {
        void narrator.speak(sharedStoryPreviewText(creator.content), undefined, { autoPlay: true })
      } else setStudioPlayRequest(value => value + 1)
    }
  }
  useEffect(() => {
    narrator.stop(); studioAudio.current?.pause()
    setStoryMode(null)
    setStudioPlayRequest(0)
    setStudioReadAlong({ text: '', position: 0, active: false })
  }, [playToken, player?.sceneIndex, player?.adventure?.revision, player?.solved, player?.skipped, creator?.ownerToken, studioScene])
  const passage = (text: string) => <StoryPassage text={text} mode={storyMode}
    narrationText={narrator.activeText || studioReadAlong.text}
    position={narrator.activeText ? narrator.textPosition : studioReadAlong.position}
    active={storyMode === 'listen' && (narrator.speaking || narrator.paused || studioReadAlong.active)} />
  const confirmShareReady = () => {
    if (!creator) return false
    if (!storyHasAccess(creator.expiresAt)) {
      setError('This story is no longer available to share.')
      return false
    }
    if (mediaFile || voiceFile || voiceUploading || upload.phase === 'uploading') {
      setError('Finish or remove the selected uploads before sharing this story.')
      return false
    }
    setError('')
    return true
  }
  const activeReaderLanguage = readerLanguage || player?.language || romanceNotice?.language || 'en-US'
  const activeReaderTranslation = readerTranslation?.language === activeReaderLanguage ? readerTranslation : null
  const recipientText = recipientCopy(activeReaderLanguage)
  const recipientLanguage = storyLanguage(activeReaderLanguage)
  const recipientEnding = sharedCreationCopy(recipientLanguage.code)
  const romanceText = romanceCopy(romanceNotice?.language || player?.language)
  const recipientRequest = <T,>(body: Record<string, unknown>) => request<T>({ ...body, ...(romanceAccepted ? { romanceConfirmed: true } : {}) })
  const applyRecipientPlayer = (next: SharedStoryPlayer, session = sessionToken, restoreCached = false) => {
    let translation = readerTranslation?.language === readerLanguage ? readerTranslation : null
    let selectedLanguage = next.language ?? 'en-US'
    if (restoreCached && session) {
      try {
        const selected = window.sessionStorage.getItem(`muse-story-translation-language:${session}`)
        const selectedOption = STORY_LANGUAGES.find(item => item.code === selected)
        if (selectedOption) selectedLanguage = selectedOption.code
        const cacheKey = `muse-story-translation:${session}:${selectedLanguage}`
        const cached = window.sessionStorage.getItem(cacheKey)
        if (cached) {
          const value: unknown = JSON.parse(cached)
          const cachedLanguage = value && typeof value === 'object' && 'language' in value
            ? STORY_LANGUAGES.find(item => item.code === value.language) : undefined
          if (cachedLanguage) {
            const parsed = parseSharedStoryTranslation(value, cachedLanguage.code)
            if (parsed.content.scenes.length === next.sceneCount) {
              translation = parsed
              selectedLanguage = parsed.language
            }
          }
        }
      } catch {
        try {
          window.sessionStorage.removeItem(`muse-story-translation:${session}:${selectedLanguage}`)
          window.sessionStorage.removeItem(`muse-story-translation-language:${session}`)
        } catch { /* Storage is optional. */ }
      }
    }
    setReaderTranslation(translation)
    setReaderLanguage(translation?.language ?? selectedLanguage)
    setSourcePlayer(next)
    setPlayer(localizeRecipientPlayer(next, translation))
  }
  const applyStoryPreferences = () => {
    try {
      const preferences = loadStoryPreferences()
      const creatorName = loadProfileDisplayName()
      setBrief(current => ({
        ...current, creatorName: current.creatorName || creatorName,
        language: preferences.language, durationMinutes: preferences.duration
      }))
      setPreferencesError('')
    } catch (cause) {
      setPreferencesError(cause instanceof Error ? `Saved story settings could not be loaded: ${cause.message}` : 'Saved story settings could not be loaded.')
    }
  }
  const rememberStoryPreferences = (language: SharedStoryBrief['language'], duration: number) => {
    try {
      const selectedLanguage = language || loadStoryPreferences().language
      saveStoryPreferences({ language: selectedLanguage, duration })
      setPreferencesError('')
    } catch (cause) {
      setPreferencesError(cause instanceof Error ? `Story settings could not be remembered: ${cause.message}` : 'Story settings could not be remembered.')
    }
  }
  const persistGiftDraftNow = (
    nextBrief: SharedStoryBrief,
    nextAssistanceHintsText = giftDraftSnapshot.current.assistanceHintsText,
    nextAlternativeAnswersText = giftDraftSnapshot.current.alternativeAnswersText
  ) => {
    const current = giftDraftSnapshot.current
    if (!current.draftReady || current.pendingDraft || current.draftUnreadable || current.loading || current.creator || current.playToken || current.busy || !hasGiftDraftWriting(nextBrief)) return
    try {
      saveGiftDraft({
        version: 1, brief: nextBrief, assistanceHintsText: nextAssistanceHintsText,
        alternativeAnswersText: nextAlternativeAnswersText, savedAt: new Date().toISOString()
      })
      setDraftStatus('Draft saved on this device. Media and recordings must be attached again after reopening.')
    } catch {
      setDraftStatus('Draft could not be saved. Keep this page open or copy your writing before leaving.')
    }
  }
  const updateBrief = (update: (current: SharedStoryBrief) => SharedStoryBrief) => {
    const nextBrief = update(giftDraftSnapshot.current.brief)
    setBrief(nextBrief)
    persistGiftDraftNow(nextBrief)
  }
  const updateGiftDraftText = (key: 'assistanceHintsText' | 'alternativeAnswersText', value: string) => {
    const current = giftDraftSnapshot.current
    const assistance = key === 'assistanceHintsText' ? value : current.assistanceHintsText
    const alternatives = key === 'alternativeAnswersText' ? value : current.alternativeAnswersText
    if (key === 'assistanceHintsText') setAssistanceHintsText(value)
    else setAlternativeAnswersText(value)
    persistGiftDraftNow(current.brief, assistance, alternatives)
  }
  const openRecipientStory = async (token: string, savedSession: string | null, romanceConfirmed = false) => {
    const sessionKey = `muse-shared-player:${token}`
    const openRequest = (sessionToken?: string, displayName?: string) => request<OpenResponse>({
      action: 'open', token, ...(sessionToken ? { sessionToken } : {}),
      ...(displayName ? { displayName } : {}), ...(romanceConfirmed ? { romanceConfirmed: true } : {})
    })
    try {
      return await openRequest(savedSession ?? undefined)
    } catch (error) {
      if (!savedSession || !(error instanceof Error) || error.message !== 'Player session is invalid. Reopen the story link.') throw error
      window.localStorage.removeItem(sessionKey)
      const result = await openRequest()
      setNotice('Your saved player session could not be restored. A new session has started; earlier progress may not be available.')
      return result
    }
  }
  useEffect(() => { setRomanceConfirmed(false) }, [brief])
  useEffect(() => {
    interaction.cancelRecording()
  }, [player?.language, brief.language])

  useEffect(() => {
    let active = true
    setOrigin(window.location.origin)
    const initialize = async () => {
      try {
        if (new URLSearchParams(window.location.search).has('share')) {
          throw new Error('This old prototype link contains exposed story data and is no longer supported. Ask the creator for a new private story link.')
        }
        const fragment = new URLSearchParams(window.location.hash.slice(1))
        const recipientToken = fragment.get('play')
        if (recipientToken) {
          setReaderTranslation(null)
          setReaderLanguage(null)
          setSourcePlayer(null)
          setTranslationConsent(false)
          setPlayToken(recipientToken)
          let savedSession: string | null = null
          try {
            savedSession = window.localStorage.getItem(`muse-shared-player:${recipientToken}`)
          } catch {
            setNotice('This browser cannot save progress. You can play now, but reopening the link will start a new session.')
          }
          const result = await openRecipientStory(recipientToken, savedSession)
          if (!active) return
          if ('romanceNotice' in result) {
            setRomanceNotice(result.romanceNotice)
            setRomanceAccepted(false)
            setRecipientConfirmation(false)
            setRomanceDeclined(false)
            setSourcePlayer(null)
            setPlayer(null)
            return
          }
          if ('requiresDisplayName' in result) {
            setSessionToken(result.sessionToken)
            setGuestNameRequired(true)
            try { window.localStorage.setItem(`muse-shared-player:${recipientToken}`, result.sessionToken) } catch {
              setNotice('This browser cannot save the guest session. Keep this page open while you play.')
            }
            return
          }
          applyRecipientPlayer(result.player, result.sessionToken, true)
          setSessionToken(result.sessionToken)
          try {
            window.localStorage.setItem(`muse-shared-player:${recipientToken}`, result.sessionToken)
          } catch {
            setNotice('This browser cannot save progress. You can play now, but reopening the link will start a new session.')
          }
          return
        }
        const libraryResult = loadStoryLibrary()
        if (libraryResult.error) setNotice(libraryResult.error)
        const reuseOwner = fragment.get('reuse')
        if (reuseOwner) {
          const source = libraryResult.library.entries.find(entry => entry.kind === 'shared' && entry.id === reuseOwner)
          if (source?.kind !== 'shared') throw new Error('This brief is not saved in this browser. Reopen it from Saved stories.')
          setBrief(source.story.brief)
          setAssistanceHintsText((source.story.brief.assistanceHints ?? []).join('\n'))
          setAlternativeAnswersText((source.story.brief.alternativeAnswers ?? []).join('\n'))
          setNotice('Brief copied from Saved stories. Review it before preparing a new gift story. Previous links and progress are unchanged; attach any media again.')
          try { setPendingDraft(loadGiftDraft()) } catch (error) { setDraftUnreadable(true); setDraftStatus(error instanceof Error ? error.message : 'Could not read your draft.') }
          setDraftReady(true)
          setCreatorStep(0)
          window.history.replaceState(null, '', '/shared#new')
          return
        }
        const requestedOwner = fragment.get('manage')
        const matching = libraryResult.library.entries.find(entry => entry.kind === 'shared' && entry.id === requestedOwner)
        const saved = matching?.kind === 'shared' ? matching.story : latestCreatorStory(libraryResult)
        const ownerToken = fragment.get('manage') || (fragment.has('new') ? null : saved?.ownerToken)
        if (ownerToken) {
          const { media, mediaRequired: _required, voice, replies: savedReplies, ...result } = await request<Omit<CreatorStory, 'ownerToken' | 'playToken'> & MediaState & GiftState>({ action: 'manage', token: ownerToken })
          if (!active) return
          const restored = { ...result, ownerToken, ...(saved?.ownerToken === ownerToken ? { playToken: saved.playToken } : {}) }
          setCreator(restored)
          setOwnerMedia(media ?? null)
          setOwnerVoice(voice ?? null)
          setReplies(savedReplies ?? [])
          setBrief(result.brief)
          setAssistanceHintsText((result.brief.assistanceHints ?? []).join('\n'))
          setAlternativeAnswersText((result.brief.alternativeAnswers ?? []).join('\n'))
          try {
            saveLibraryCreatorStory(restored)
          } catch (error) {
            setNotice(`${error instanceof Error ? error.message : 'This browser could not save your management link.'} Keep a copy of your private management link yourself.`)
          }
        } else {
          try {
            const draft = loadGiftDraft()
            setPendingDraft(draft)
            if (!draft) applyStoryPreferences()
          } catch (error) { setDraftUnreadable(true); setDraftStatus(error instanceof Error ? error.message : 'Could not read your draft.') }
          setDraftReady(true)
        }
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : 'Could not open this story.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void initialize()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!playToken || !player || (romanceNotice && !romanceAccepted)) return
    let active = true
    const revision = player.adventure?.revision ?? player.sceneIndex
    const isAdventure = Boolean(player.adventure)
    const preservePendingAction = recipientTokenRef.current === playToken &&
      recipientDraftRef.current.ready && recipientDraftRef.current.revision !== revision && Boolean(actionTextRef.current)
    recipientTokenRef.current = playToken
    setRecipientDraft({ revision: null, answerKey: '', actionKey: '', answerWritable: false, actionWritable: false, ready: false })
    setRecipientDraftError('')
    setGuess('')
    if (!preservePendingAction) setActionText('')
    void (async () => {
      let answerKey = ''
      let actionKey = ''
      let answerWritable = false
      let actionWritable = false
      let draftError = ''
      try {
        answerKey = await recipientAnswerDraftKey(playToken, 'answer', revision)
        if (isAdventure) actionKey = await recipientAnswerDraftKey(playToken, 'action', revision)
        const answer = readDraft(answerKey, isRecipientAnswerDraft)
        if (answer) {
          if (answer.revision !== revision) throw new Error('The saved answer belongs to a different story step and was not restored.')
          if (active) setGuess(answer.text)
        }
        answerWritable = true
      } catch (cause) {
        draftError = cause instanceof Error ? cause.message : 'Could not read the saved answer. It was not overwritten.'
      }
      if (isAdventure && actionKey) {
        try {
          const action = readDraft(actionKey, isRecipientAnswerDraft)
          if (action) {
            if (action.revision !== revision) throw new Error('The saved action belongs to a different story step and was not restored.')
            if (active && !preservePendingAction) setActionText(action.text)
          }
          actionWritable = true
        } catch (cause) {
          draftError = [draftError, cause instanceof Error ? cause.message : 'Could not read the saved action. It was not overwritten.'].filter(Boolean).join(' ')
        }
      }
      if (active) {
        setRecipientDraft({ revision, answerKey, actionKey, answerWritable, actionWritable, ready: true })
        setRecipientDraftError(draftError)
      }
    })()
    return () => { active = false }
  }, [playToken, player?.sceneIndex, player?.adventure?.revision, Boolean(player?.adventure), Boolean(romanceNotice && !romanceAccepted)])

  useEffect(() => {
    if (!playToken || !sessionToken || !player?.cooperative || (romanceNotice && !romanceAccepted)) return
    let active = true
    const refresh = async () => {
      try {
        const result = await request<OpenResponse>({
          action: 'open', token: playToken, sessionToken,
          ...(romanceAccepted ? { romanceConfirmed: true } : {})
        })
        if ('requiresDisplayName' in result) {
          if (active) {
            setGuestNameRequired(true)
            setCooperativeSyncError('')
          }
        } else if (!('romanceNotice' in result) && active) {
          applyRecipientPlayer(result.player, sessionToken)
          setCooperativeSyncError('')
        }
      } catch (cause) {
        if (active) setCooperativeSyncError(cause instanceof Error ? cause.message : 'Could not refresh cooperative progress.')
      }
    }
    const timer = window.setInterval(() => { void refresh() }, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [playToken, sessionToken, Boolean(player?.cooperative), Boolean(romanceNotice && !romanceAccepted), romanceAccepted])

  useEffect(() => {
    if (!recipientDraft.ready || !player) return
    const revision = player.adventure?.revision ?? player.sceneIndex
    if (recipientDraft.revision !== revision) return
    const persist = (key: string, writable: boolean, text: string) => {
      if (!key || !writable) return
      try {
        if (text) writeDraft(key, { revision, text })
        else removeDraft(key)
      } catch (cause) {
        setRecipientDraftError(cause instanceof Error ? cause.message : 'Your unsent answer could not be saved on this device.')
      }
    }
    persist(recipientDraft.answerKey, recipientDraft.answerWritable, guess)
    persist(recipientDraft.actionKey, recipientDraft.actionWritable, actionText)
  }, [recipientDraft, player?.sceneIndex, player?.adventure?.revision, guess, actionText])

  const acceptRomance = async () => {
    if (!romanceNotice || !recipientConfirmation || busy) return
    setBusy(true); setError('')
    try {
      let savedSession: string | null = null
      try { savedSession = window.localStorage.getItem(`muse-shared-player:${playToken}`) } catch {
        setNotice('This browser cannot save progress. Reopening will require a new opt-in and may start a new session.')
      }
      const result = await openRecipientStory(playToken, savedSession, true)
      if ('romanceNotice' in result) throw new Error('Confirm you are 18 or older and choose to open this romance story before continuing.')
      setRomanceAccepted(true)
      if ('requiresDisplayName' in result) {
        setSessionToken(result.sessionToken)
        setGuestNameRequired(true)
        return
      }
      applyRecipientPlayer(result.player, result.sessionToken, true)
      setSessionToken(result.sessionToken)
      try { window.localStorage.setItem(`muse-shared-player:${playToken}`, result.sessionToken) } catch {
        setNotice('This browser cannot save progress. Keep this page open to continue.')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not open this story.')
    } finally { setBusy(false) }
  }

  const joinCooperativeAsGuest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const displayName = guestDisplayName.trim()
    if (!displayName || displayName.length > 40) {
      setError('Enter a display name of 1 to 40 characters.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await request<OpenResponse>({
        action: 'open', token: playToken, sessionToken, displayName,
        ...(romanceAccepted ? { romanceConfirmed: true } : {})
      })
      if ('romanceNotice' in result || 'requiresDisplayName' in result) {
        throw new Error('Muse could not register this display name. Check it and try again.')
      }
      applyRecipientPlayer(result.player, result.sessionToken, true)
      setSessionToken(result.sessionToken)
      setGuestNameRequired(false)
      window.localStorage.setItem(`muse-shared-player:${playToken}`, result.sessionToken)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not join this cooperative story.')
    } finally {
      setBusy(false)
    }
  }

  const startGiftStory = async () => {
    if (!player || busy) return
    const source = sourcePlayer ?? player
    const sourceLanguage = source.language ?? 'en-US'
    const targetLanguage = readerLanguage ?? sourceLanguage
    if (targetLanguage === sourceLanguage) {
      setReaderTranslation(null)
      setReaderLanguage(targetLanguage)
      setPlayer(source)
      setGiftOpened(true)
      return
    }
    if (activeReaderTranslation?.language === targetLanguage) {
      setGiftOpened(true)
      return
    }
    const cacheKey = `muse-story-translation:${sessionToken}:${targetLanguage}`
    try {
      const cached = window.sessionStorage.getItem(cacheKey)
      if (cached) {
        const translation = parseSharedStoryTranslation(JSON.parse(cached), targetLanguage)
        if (translation.content.scenes.length === source.sceneCount) {
          setReaderTranslation(translation)
          setReaderLanguage(targetLanguage)
          try { window.sessionStorage.setItem(`muse-story-translation-language:${sessionToken}`, targetLanguage) } catch {
            setNotice(flow('translationCacheUnavailable'))
          }
          setPlayer(localizeRecipientPlayer(source, translation))
          setTranslationConsent(false)
          setGiftOpened(true)
          return
        }
        window.sessionStorage.removeItem(cacheKey)
      }
    } catch {
      setNotice(flow('translationCacheUnavailable'))
    }
    if (!translationConsent) {
      setError(flow('translationConsentRequired'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await recipientRequest<{ translation: unknown }>({
        action: 'translate', token: playToken, sessionToken, language: targetLanguage, translationConsent: true
      })
      const translation = parseSharedStoryTranslation(result.translation, targetLanguage)
      if (translation.content.scenes.length !== source.sceneCount) throw new Error('The translated story has an unexpected number of scenes.')
      try {
        window.sessionStorage.setItem(cacheKey, JSON.stringify(translation))
        window.sessionStorage.setItem(`muse-story-translation-language:${sessionToken}`, targetLanguage)
      } catch {
        setNotice(flow('translationCacheUnavailable'))
      }
      setReaderTranslation(translation)
      setReaderLanguage(targetLanguage)
      setPlayer(localizeRecipientPlayer(source, translation))
      setTranslationConsent(false)
      setGiftOpened(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not translate the story. The AI attempt may count; check the story before deciding whether to try again.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!draftReady || pendingDraft || draftUnreadable || loading || creator || playToken || busy) return
    if (!hasGiftDraftWriting(brief)) return
    const timer = window.setTimeout(() => {
      try {
        saveGiftDraft({ version: 1, brief, assistanceHintsText, alternativeAnswersText, savedAt: new Date().toISOString() })
        setDraftStatus('Draft saved on this device. Media and recordings must be attached again after reopening.')
      } catch {
        setDraftStatus('Draft could not be saved. Keep this page open or copy your writing before leaving.')
      }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [brief, assistanceHintsText, alternativeAnswersText, draftReady, pendingDraft, draftUnreadable, loading, creator, playToken, busy])
  useEffect(() => {
    const flushGiftDraft = () => {
      const draft = giftDraftSnapshot.current
      if (!draft.draftReady || draft.pendingDraft || draft.draftUnreadable || draft.loading || draft.creator || draft.playToken || draft.busy || !hasGiftDraftWriting(draft.brief)) return
      try {
        saveGiftDraft({
          version: 1, brief: draft.brief, assistanceHintsText: draft.assistanceHintsText,
          alternativeAnswersText: draft.alternativeAnswersText, savedAt: new Date().toISOString()
        })
      } catch {
        setDraftStatus('Draft could not be saved before leaving. Keep this page open or copy your writing before leaving.')
      }
    }
    window.addEventListener('pagehide', flushGiftDraft)
    return () => window.removeEventListener('pagehide', flushGiftDraft)
  }, [])

  const chooseOccasion = (occasion?: GiftOccasion) => {
    const chosen = GIFT_OCCASIONS.find(item => item.id === occasion)
    updateBrief(current => {
      const { gift: _gift, ...rest } = current
      if (!chosen) return rest
      const presetSetting = !current.setting || GIFT_OCCASIONS.some(item => item.idea === current.setting)
      const presetGoal = !current.goal || GIFT_OCCASIONS.some(item => item.goal === current.goal)
      return { ...current, gift: { occasion: chosen.id, dedication: current.gift?.dedication ?? '', allowReply: current.gift?.allowReply ?? false },
        setting: presetSetting ? chosen.idea : current.setting, goal: presetGoal ? chosen.goal : current.goal }
    })
    setAiConsent(false)
  }

  const storeCreator = (story: CreatorStory) => {
    setCreator(story)
    try {
      saveLibraryCreatorStory(story)
      return true
    } catch (error) {
      setNotice(`${error instanceof Error ? error.message : 'This browser could not save the management link.'} The remote story still exists. Copy the private management link now to keep access.`)
      return false
    }
  }

  const startNewStory = (reuseBrief = false) => {
    if (busy || voiceRecording || voiceUploading || !creator) return
    try {
      saveLibraryCreatorStory(creator)
    } catch (error) {
      setError(`${error instanceof Error ? error.message : 'Could not save this story in your library.'} Copy your private management link before leaving this preview.`)
      return
    }
    interaction.stopRecording()
    narrator.stop()
    if (!reuseBrief) {
      setBrief({ ...blankBrief })
      setAssistanceHintsText('')
      setAlternativeAnswersText('')
    }
    setCreator(null)
    setRomanceConfirmed(false)
    setOwnerMedia(null)
    setOwnerPreview(null)
    setMediaFile(null)
    setVoiceFile(null)
    setOwnerVoice(null)
    setVoiceUrl('')
    setVoiceError('')
    setReplies([])
    try {
      const draft = loadGiftDraft()
      setPendingDraft(draft)
      if (!reuseBrief && !draft) applyStoryPreferences()
    } catch (error) { setDraftUnreadable(true); setDraftStatus(error instanceof Error ? error.message : 'Could not read your draft.') }
    setDraftReady(true)
    setUpload(idleUpload)
    setAiConsent(false)
    setError('')
    setNotice('Your previous gift story is in Saved stories. Its recipient link and progress are unchanged.')
    objectUrls.current.forEach(url => URL.revokeObjectURL(url))
    objectUrls.current = []
    window.history.replaceState(null, '', '/shared#new')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => () => { objectUrls.current.forEach(url => URL.revokeObjectURL(url)) }, [])

  const mediaUrl = (result: { url: string; blob: boolean }) => {
    if (result.blob) objectUrls.current.push(result.url)
    return result.url
  }

  const chooseFile = (file: File | null) => {
    setUpload(idleUpload)
    if (!file) { setMediaFile(null); return }
    try {
      parseMediaDeclaration({ mime: file.type, size: file.size })
      setMediaFile(file)
      setError('')
    } catch (error) {
      setMediaFile(null)
      setError(error instanceof Error ? error.message : 'This file cannot be used.')
    }
  }

  // Attaches media to an already generated story. Failures never discard the
  // story or the chosen file, so retrying costs no new AI generation.
  const uploadMedia = async (story: CreatorStory, file: File) => {
    setUpload({ phase: 'uploading', progress: 0 })
    let uploadId = ''
    try {
      validateVoiceBytes(new Uint8Array(await file.arrayBuffer()))
      const declaration = parseMediaDeclaration({ mime: file.type, size: file.size })
      const started = await request<{ uploadId: string; upload: UploadTarget }>({ action: 'media-start', token: story.ownerToken, media: { mime: declaration.mime, size: declaration.size } })
      uploadId = started.uploadId
      await putFile(started.upload, file, progress => setUpload({ phase: 'uploading', progress }))
      const finished = await request<MediaState>({ action: 'media-finish', token: story.ownerToken, uploadId })
      uploadId = ''
      setOwnerMedia(finished.media)
      setOwnerPreview(null)
      setMediaFile(null)
      setVoiceFile(null)
      setOwnerVoice(null)
      setVoiceUrl('')
      setVoiceError('')
      setReplies([])
      setDraftReady(true)
      setCreatorStep(0)
      try { setPendingDraft(loadGiftDraft()) } catch (error) { setDraftUnreadable(true); setDraftStatus(error instanceof Error ? error.message : 'Could not read your draft.') }
      setUpload(idleUpload)
      setNotice(`Your ${mediaLabel(declaration.kind)} is attached privately. It unlocks only after a correct answer.`)
      return true
    } catch (error) {
      if (uploadId) void request({ action: 'media-cancel', token: story.ownerToken, uploadId }).catch(() => undefined)
      setUpload({ phase: 'failed', progress: 0, error: `${error instanceof Error ? error.message : 'The upload failed.'} Your story is saved; retry the upload without generating it again.` })
      return false
    }
  }

  const removeMedia = async () => {
    if (!creator) return
    if (!creator.brief.message && !window.confirm('This story has no written message. Without the photo or video, recipients cannot finish it until you attach another file. Remove it?')) return
    setBusy(true)
    setError('')
    try {
      const result = await request<MediaState>({ action: 'media-delete', token: creator.ownerToken })
      setOwnerMedia(result.media)
      setOwnerPreview(null)
      setNotice('The photo or video was removed and deleted from private storage.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not remove the photo or video.')
    } finally {
      setBusy(false)
    }
  }

  const previewMedia = async () => {
    if (!creator || !ownerMedia) return
    setOwnerPreview({ kind: ownerMedia.kind, state: 'loading' })
    try {
      const result = await requestMedia({ action: 'media-preview', token: creator.ownerToken })
      setOwnerPreview({ kind: ownerMedia.kind, state: 'ready', url: mediaUrl(result) })
    } catch {
      setOwnerPreview({ kind: ownerMedia.kind, state: 'error' })
    }
  }

    const uploadVoice = async (story: CreatorStory, file: File) => {
      setVoiceUploading(true)
      setVoiceError('')
      let uploadId = ''
      try {
        const started = await request<{ uploadId: string; upload: UploadTarget }>({ action: 'voice-start', token: story.ownerToken, voice: { mime: 'audio/wav', size: file.size } })
        uploadId = started.uploadId
        await putFile(started.upload, file, () => undefined)
        const finished = await request<GiftState>({ action: 'voice-finish', token: story.ownerToken, uploadId })
        uploadId = ''
        setOwnerVoice(finished.voice ?? null)
        setVoiceFile(null)
        setVoiceUrl('')
        setNotice('Your voice message is attached. It unlocks with the final reveal.')
      } catch (error) {
        setVoiceError(`${error instanceof Error ? error.message : 'Could not upload the recording.'} Your story is saved. Retry without generating again.`)
        if (uploadId) {
          try { await request({ action: 'voice-cancel', token: story.ownerToken, uploadId }) }
          catch { setVoiceError(current => `${current} The unfinished upload could not be cancelled; it will expire automatically.`) }
        }
      } finally { setVoiceUploading(false) }
    }

    const loadVoice = async (owner = false) => {
      setVoiceError('')
      try {
        const result = await requestMedia(owner && creator ? { action: 'voice-preview', token: creator.ownerToken } : { action: 'voice', token: playToken, sessionToken, ...(romanceAccepted ? { romanceConfirmed: true } : {}) })
        setVoiceUrl(mediaUrl(result))
      } catch (error) { setVoiceError(error instanceof Error ? error.message : 'Could not load the voice message. Try again.') }
    }

    const removeVoice = async () => {
      if (!creator || !window.confirm('Remove your stored voice message? The written story and other media will remain.')) return
      setBusy(true)
      try {
        await request({ action: 'voice-delete', token: creator.ownerToken })
        setOwnerVoice(null); setVoiceUrl(''); setVoiceError('')
      } catch (error) { setVoiceError(error instanceof Error ? error.message : 'Could not remove the voice message.') }
      finally { setBusy(false) }
    }

    const sendReply = async () => {
      setBusy(true); setError('')
      try {
        await recipientRequest({ action: 'reply', token: playToken, sessionToken, reply: replyText.trim() })
        setReplySent(true)
        setNotice('Your reply was sent privately to the sender.')
      } catch (error) { setError(error instanceof Error ? error.message : 'Could not send your reply. Your text is kept here; try again.') }
      finally { setBusy(false) }
    }

    const refreshReplies = async () => {
      if (!creator) return
      setBusy(true); setError('')
      try {
        const result = await request<GiftState>({ action: 'manage', token: creator.ownerToken })
        setReplies(result.replies ?? [])
      } catch (error) { setError(error instanceof Error ? error.message : 'Could not load replies.') }
      finally { setBusy(false) }
    }

    const createFollowUpStory = async () => {
      if (!creator || !followUpReply || !hasExplicitConsent(followUpConsent)) return
      setBusy(true); setError(''); setNotice('')
      try {
        const { media: _media, mediaRequired: _required, voice: _voice, replies: _replies, ...story } =
          await request<CreatorStory & MediaState & GiftState>({
            action: 'follow-up', token: creator.ownerToken,
            reply: followUpReply.message, replyCreatedAt: followUpReply.createdAt,
            direction: followUpDirection, goal: followUpGoal, solution: followUpSolution,
            message: followUpMessage, consentVersion: MUSE_AI_CONSENT_VERSION,
            ...(creator.brief.romance ? { romanceConfirmed: followUpRomanceConfirmed } : {})
          })
        setBrief(story.brief)
        setAssistanceHintsText('')
        setAlternativeAnswersText('')
        setOwnerMedia(null); setOwnerVoice(null); setVoiceUrl('')
        setReplies([])
        setFollowUpReply(null); setFollowUpConsent(false)
        setFollowUpRomanceConfirmed(false)
        setCreatorStep(0)
        storeCreator(story)
        window.history.replaceState(null, '', `/shared#manage=${story.ownerToken}`)
        setNotice('Follow-up story prepared. Review its clues and recipient experience before sharing.')
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Could not create the follow-up story. The original gift and recipient reply remain unchanged.')
      } finally { setBusy(false) }
    }

    const loadRevealMedia = useCallback(async (kind: SharedMediaKind) => {
    setRevealMedia(current => current?.url ? current : { kind, state: 'loading' })
    try {
      const result = await requestMedia({ action: 'media', token: playToken, sessionToken, ...(romanceAccepted ? { romanceConfirmed: true } : {}) })
      setRevealMedia({ kind, state: 'ready', url: mediaUrl(result) })
    } catch {
      setRevealMedia({ kind, state: 'error' })
    }
  }, [playToken, sessionToken, romanceAccepted])

  const solvedMediaKind = player?.solved || player?.skipped ? player.media?.kind : undefined
  useEffect(() => {
    if (solvedMediaKind) void loadRevealMedia(solvedMediaKind)
  }, [solvedMediaKind, loadRevealMedia])

  // Signed URLs expire after a few minutes; refresh once in a while on errors.
  const refreshRevealMedia = () => {
    if (!revealMedia || Date.now() - lastMediaRefresh.current < 30000) {
      if (revealMedia) setRevealMedia({ kind: revealMedia.kind, state: 'error' })
      return
    }
    lastMediaRefresh.current = Date.now()
    void loadRevealMedia(revealMedia.kind)
  }

  const nextCreatorStep = () => {
    const fields = creatorForm.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')
    if (fields) {
      for (const field of Array.from(fields)) {
        if (!field.checkValidity()) { field.reportValidity(); return }
      }
    }
    setCreatorStep(step => Math.min(2, step + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const generate = async (event: FormEvent) => {
    event.preventDefault()
    if (creatorStep < 2) { nextCreatorStep(); return }
    if (busy) return
    if (voiceRecording || voiceUploading || pendingDraft || draftUnreadable) {
      setError('Finish the recording and restore or discard any saved draft before preparing the story.')
      return
    }
    if (!hasExplicitConsent(aiConsent)) {
      setError('Review the AI disclosure and check the consent box before preparing this story.')
      return
    }
    try { requireRomanceConfirmation(brief.romance, romanceConfirmed) } catch (error) {
      setError(error instanceof Error ? error.message : 'Confirm the romance boundaries before preparing this story.')
      return
    }
    setAiConsent(false)
    setBusy(true)
    setError('')
    setNotice('')
    interaction.cancelRecording()
    narrator.stop()
    try {
      if (voiceFile) validateVoiceBytes(new Uint8Array(await voiceFile.arrayBuffer()))
      const declaration = mediaFile ? parseMediaDeclaration({ mime: mediaFile.type, size: mediaFile.size }) : null
      if (!declaration && !brief.message.trim()) throw new Error('Write a final message, attach a photo or video, or both.')
      const answerEnding = !brief.endingMode || brief.endingMode === 'answer'
      const assistanceHints = answerEnding ? assistanceLines(assistanceHintsText) : []
      const alternativeAnswers = answerEnding ? assistanceLines(alternativeAnswersText) : []
      if (assistanceHints.length > 3 || assistanceHints.some(hint => hint.length > 600)) {
        throw new Error('Enter up to 3 assistance hints, with at most 600 characters each.')
      }
      if (alternativeAnswers.length > 5 || alternativeAnswers.some(answer => answer.length > 200)) {
        throw new Error('Enter up to 5 approved alternative answers, with at most 200 characters each.')
      }
      if (brief.adventure && !(Number.isInteger(brief.adventure.actionBudget) && brief.adventure.actionBudget >= 1 && brief.adventure.actionBudget <= 1000)) {
        throw new Error('Under Advanced options, approve an adventure AI action budget from 1 to 1000.')
      }
      const preparedBrief: SharedStoryBrief = {
        ...brief, narration: brief.narration.trim() || DEFAULT_NARRATION, assistanceHints, alternativeAnswers,
        solution: answerEnding ? brief.solution : '',
        endingChoices: brief.endingMode === 'choice' ? parseSuggestedChoices((brief.endingChoices ?? []).map(choice => choice.trim()).filter(Boolean)) : undefined
      }
      try { saveGiftDraft({ version: 1, brief: preparedBrief, assistanceHintsText, alternativeAnswersText, savedAt: new Date().toISOString() }) }
      catch { setDraftStatus('Draft could not be saved on this device. Keep the page open if preparation fails.') }
      const { media: _media, mediaRequired: _required, voice: _voice, replies: _replies, ...story } = await request<CreatorStory & MediaState & GiftState>({
        action: 'create', brief: preparedBrief, consentVersion: MUSE_AI_CONSENT_VERSION,
        ...(brief.romance ? { romanceConfirmed } : {}),
        ...(voiceFile ? { finalVoice: { mime: 'audio/wav', size: voiceFile.size } } : {}),
        ...(declaration ? { finalMedia: { mime: declaration.mime, size: declaration.size } } : {})
      })
      setBrief(story.brief)
      setAssistanceHintsText((story.brief.assistanceHints ?? []).join('\n'))
      setAlternativeAnswersText((story.brief.alternativeAnswers ?? []).join('\n'))
      setOwnerMedia(null)
      setOwnerPreview(null)
      storeCreator(story)
      try { removeGiftDraft(); setDraftStatus('') } catch { setNotice('Story created, but the old draft could not be removed from this device. Discard it next time you create a story.') }
      window.history.replaceState(null, '', `/shared#manage=${story.ownerToken}`)
      if (mediaFile) await uploadMedia(story, mediaFile)
      if (voiceFile) await uploadVoice(story, voiceFile)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not generate the story.')
    } finally {
      setBusy(false)
    }
  }

  const act = async (action: 'guess' | 'next' | 'hint' | 'skip' | 'cooperative-pass' | 'ending-choice', choiceIndex?: number) => {
    if (action === 'skip' && !window.confirm(recipientText.skipConfirm)) return
    setBusy(true)
    setError('')
    interaction.cancelRecording()
    narrator.stop()
    try {
      const result = await recipientRequest<PlayerResponse>({ action, token: playToken, sessionToken, ...(action === 'guess' ? { guess } : {}), ...(action === 'skip' ? { confirmSkip: true } : {}), ...(action === 'ending-choice' ? { choiceIndex } : {}) })
      applyRecipientPlayer(result.player)
      if (action !== 'hint') setGuess('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not continue the story.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!playToken || !sessionToken || !player?.adventure?.pending || busy || (romanceNotice && !romanceAccepted)) return
    const timer = window.setTimeout(() => { void adventureAction(true) }, error ? 15000 : 3000)
    return () => window.clearTimeout(timer)
  }, [playToken, sessionToken, player?.adventure?.pending, busy, error, romanceNotice, romanceAccepted])

  const adventureAction = async (refresh = false, selectedChoice?: string) => {
      if (!player?.adventure) return
      if (!refresh && !hasExplicitConsent(aiConsent)) {
        setError('Review the AI disclosure and check the consent box before sending this action.')
        return
      }
      if (!refresh) setAiConsent(false)
      setBusy(true)
      setError('')
      if (!refresh) { interaction.cancelRecording(); narrator.stop() }
      const storageKey = `muse-adventure-action:${playToken}:${sessionToken}`
      try {
        let submission: Record<string, unknown> = { action: 'open', token: playToken, sessionToken }
        if (!refresh) {
          const saved = window.localStorage.getItem(storageKey)
          // Persist before sending. Network retries and tabs reuse the same ID;
          // a changed draft cannot silently turn a retry into another paid call.
          const attempt = {
            ...(saved ? JSON.parse(saved) : {
              requestId: crypto.randomUUID(), revision: player.adventure.revision,
              text: selectedChoice ?? actionText.trim(), language: activeReaderLanguage
            }),
            consentVersion: MUSE_AI_CONSENT_VERSION
          }
          if (!attempt.language) attempt.language = activeReaderLanguage
          window.localStorage.setItem(storageKey, JSON.stringify(attempt))
          if (saved) setActionText(attempt.text)
          submission = { action: 'adventure', token: playToken, sessionToken, ...attempt, consentVersion: MUSE_AI_CONSENT_VERSION }
        }
        const response = await accountFetch('/api/shared-story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...submission, ...(romanceAccepted ? { romanceConfirmed: true } : {}) }) })
        const data = await response.json()
        if (data.player) applyRecipientPlayer(data.player)
        if (!refresh && data.player && (!data.player.adventure?.pending || response.ok)) {
          window.localStorage.removeItem(storageKey)
        }
        if (!response.ok) throw new Error(data.error || 'The action could not be completed. Refresh progress; do not create another retry ID.')
        if (!refresh) setActionText('')
        // A refresh resolves a stored interrupted attempt without another call.
        if (refresh && !data.player.adventure?.pending) window.localStorage.removeItem(storageKey)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Action failed. Refresh progress or retry the same submission.')
      } finally {
        setBusy(false)
      }
  }

  const creatorAction = async (action: 'share' | 'delete') => {
    if (!creator || busy) return
    if (action === 'share' && !confirmShareReady()) return
    setBusy(true)
    setError('')
    narrator.stop()
    try {
      if (action === 'share') {
        const result = await request<{ playToken: string }>({ action, token: creator.ownerToken })
        const saved = storeCreator({ ...creator, playToken: result.playToken })
        if (saved) setNotice('New recipient link created. Any previous recipient link no longer works.')
      } else {
        await request({ action, token: creator.ownerToken })
        setCreator(null)
        setOwnerMedia(null)
        setOwnerPreview(null)
        setMediaFile(null)
        setUpload(idleUpload)
        window.history.replaceState(null, '', '/shared#new')
        setNotice('Story deleted. Both private links have stopped working.')
        try {
          removeLibraryEntry('shared', creator.ownerToken)
        } catch (error) {
          setNotice(`Remote story deleted; both private links have stopped working. ${error instanceof Error ? error.message : 'The browser library entry could not be removed.'}`)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update the story.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  const textField = (key: Exclude<keyof SharedStoryBrief, 'durationMinutes' | 'adventure' | 'unlockPolicy' | 'gift' | 'language' | 'romance' | 'answerType' | 'participants' | 'endingMode' | 'endingChoices' | AssistanceField>, label: string, placeholder: string, max: number, optional = false) => (
    <div style={{ marginBottom: '1.2rem' }}>
      <label htmlFor={`brief-${key}`} style={{ fontWeight: 700 }}>{label}{optional ? ` ${flow('optional')}` : ''}</label>
      {key === 'creatorName' || key === 'recipientName' ? <input id={`brief-${key}`} type="text" required={!optional} value={brief[key]} onFocus={() => interaction.cancelRecording()} onChange={event => { interaction.cancelRecording(); updateBrief(current => ({ ...current, [key]: event.target.value })); setAiConsent(false) }} maxLength={max} placeholder={placeholder} style={fieldStyle} disabled={busy} /> :
        <textarea id={`brief-${key}`} required={!optional} value={brief[key]} onFocus={() => interaction.cancelRecording()} onChange={(event) => { interaction.cancelRecording(); updateBrief(current => ({ ...current, [key]: event.target.value })); setAiConsent(false) }} rows={Math.max(key === 'setting' || key === 'message' ? 4 : 2, Math.ceil(placeholder.length / 24))} maxLength={max} placeholder={placeholder} style={fieldStyle} disabled={busy} />}
      <DictationButton label={`${flow('dictate')} ${label}`} stopLabel={flow('stopUseText')} stoppingLabel={flow('finishing')} recording={interaction.recordingTarget === key || interaction.stoppingTarget === key} stopping={interaction.stoppingTarget === key} disabled={busy || Boolean(interaction.stoppingTarget)} onStart={() => interaction.dictate(key, (value) => { updateBrief(current => ({ ...current, [key]: value.slice(0, max) })); setAiConsent(false) }, key === 'creatorName' || key === 'recipientName')} onStop={() => interaction.stopRecording(key)} style={{ ...buttonStyle, marginTop: '0.5rem', fontSize: '0.85rem' }} />
      {interaction.stoppingTarget === key ? <p role="status">{flow('finishing')}</p> : interaction.recordingTarget === key ? <p role="status">{interaction.ready ? flow('listen') : flow('startingMic')}</p> : null}
    </div>
  )

  const assistanceField = (key: AssistanceField, label: string, description: string, maxEntries: number, maxEntryLength: number) => {
    const value = key === 'assistanceHints' ? assistanceHintsText : alternativeAnswersText
    return (
      <div style={{ marginBottom: '1.2rem' }}>
        <label htmlFor={`brief-${key}`} style={{ fontWeight: 700 }}>{label} (optional)</label>
        <textarea id={`brief-${key}`} value={value} onChange={event => {
          const nextValue = event.target.value
          if (key === 'assistanceHints') updateGiftDraftText('assistanceHintsText', nextValue)
          else updateGiftDraftText('alternativeAnswersText', nextValue)
          setAiConsent(false)
        }} rows={maxEntries} maxLength={maxEntries * (maxEntryLength + 2)} placeholder={flow('onePerLine')} aria-describedby={`brief-${key}-help`} style={fieldStyle} disabled={busy} />
        <p id={`brief-${key}-help`}>{description}</p>
      </div>
    )
  }

  const audioButton = (text: string) => storyMode === 'listen' ? <NarrationButton narrator={narrator} text={text} label={interfaceCopy.listen} beforeSpeak={beforeDeviceListen} /> : null

  const shareDetails = origin && creator?.playToken ? recipientShareDetails(publicOrigin || origin, creator.playToken) : null
  const selectedOccasion = GIFT_OCCASIONS.find(item => item.id === brief.gift?.occasion)
  const showGiftCover = Boolean(player?.gift && !giftOpened)
  const adventureCanSubmit = Boolean(player?.adventure &&
    (player.adventure.pending || (player.adventure.actionsRemaining > 0 && player.adventure.budgetRemaining > 0)) &&
    (!player.cooperative || player.cooperative.isYourTurn))

  return (
    <main className="atelier-page" lang={playToken ? activeReaderLanguage : interfaceLanguage}
      dir={playToken ? recipientLanguage.dir : STORY_LANGUAGES.find(option => option.code === interfaceLanguage)?.dir}>
      <Head>
        <title>{`Muse - ${pageText('giftEyebrow', playToken ? recipientLanguage.code : interfaceLanguage)}`}</title>
        <meta name="description" content="Give Muse your idea and personal clues. Create a mystery for someone else to solve." />
        <meta name="referrer" content="no-referrer" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <SiteNavigation pathname="/shared" recipient={Boolean(playToken)} interfaceLanguage={interfaceLanguage} />
      {!playToken && !creator ? <PageIllustration pathname="/shared" /> : null}
      <div style={{ maxWidth: 850, margin: '0 auto', padding: 'clamp(1rem, 4vw, 1.5rem)' }}>
        {error || interaction.error || narrator.error ? <p role="alert" style={{ ...cardStyle, color: '#a14329' }}>{error || interaction.error || narrator.error}{(error || interaction.error || narrator.error).includes('Visit /billing') ? <> <Link href="/billing">See Muse Plus benefits and subscribe</Link>.</> : null}</p> : null}
        {error.toLowerCase().includes('sign in') && playToken ? <p style={cardStyle}><Link href="/account">Sign in to Muse</Link>, then reopen this private story link to join the cooperative adventure.</p> : null}
        {cooperativeSyncError ? <p role="alert" style={cardStyle}>{cooperativeSyncError}</p> : null}
        {preferencesError ? <p role="alert" style={{ ...cardStyle, color: '#a14329' }}>{preferencesError}</p> : null}
        {notice ? <p role="status" style={cardStyle}>{notice}</p> : null}
        {!playToken && !creator && !showGiftCover && !(romanceNotice && !romanceAccepted) ? <details style={{ marginBottom: '1rem' }}>
          <summary>{flow('microphoneSettings')}</summary>
          {playToken ? <p lang={recipientLanguage.code} dir={recipientLanguage.dir}>{recipientText.settingsDisclosure}</p> : null}
          <section aria-label={flow('microphoneSettings')}>
          <p>{flow('voicePrivacy')}</p>
          <MicrophoneCheck stopSignal={voiceRecording ? 'gift-voice-recording' : interaction.recordingTarget} beforeTest={() => { interaction.stopRecording(); narrator.stop() }} />
          </section>
        </details> : null}
        {recipientDraftError ? <p role="alert" style={{ ...cardStyle, color: '#a14329' }}>{recipientDraftError}</p> : null}
        {playToken && player && !recipientDraft.ready ? <p role="status">Checking for an unsent answer saved in this browser…</p> : null}
        {loading ? <p role="status">Opening your private story...</p> : playToken && romanceNotice && !romanceAccepted ? (
          <section lang={recipientLanguage.code} dir={recipientLanguage.dir} aria-label="Romance content notice" style={cardStyle}>
            <h1>{romanceText.title(romanceNotice.romance)}</h1>
            {romanceDeclined ? <>
              <p role="status">{romanceText.declined}</p>
              <Link href="/" style={{ color: 'inherit' }}>Muse</Link>
            </> : <>
              <p style={{ lineHeight: 1.8 }}>{romanceText.notice(romanceNotice.romance)}</p>
              <label style={{ display: 'block', lineHeight: 1.8, padding: '1rem 0' }}>
                {!permissions.managed ? <><input type="checkbox" checked={recipientConfirmation} disabled={busy} onChange={event => setRecipientConfirmation(event.target.checked)} /> {romanceText.confirm}</> : null}
                {permissions.managed && !permissions.romance ? <a href="/account">{registrationCopy(interfaceLanguage).settings}</a> : null}
              </label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button type="button" disabled={busy || !recipientConfirmation} onClick={() => void acceptRomance()} style={primaryStyle}>{romanceText.open}</button>
                <button type="button" disabled={busy} onClick={() => { narrator.stop(); interaction.stopRecording(); setRecipientConfirmation(false); setRomanceDeclined(true) }} style={buttonStyle}>{romanceText.decline}</button>
              </div>
            </>}
          </section>
        ) : playToken && guestNameRequired ? (
          <section className="atelier-card" aria-label="Join cooperative story">
            <h1>Join this shared story</h1>
            <p>You can join as a guest. Choose a display name so the group knows whose turn it is. Muse account members are identified by their profile name.</p>
            <form onSubmit={event => void joinCooperativeAsGuest(event)}>
              <label htmlFor="cooperative-guest-name">Your display name
                <input id="cooperative-guest-name" type="text" maxLength={40} required value={guestDisplayName} onChange={event => setGuestDisplayName(event.target.value)} style={fieldStyle} />
              </label>
              <button type="submit" disabled={busy || !guestDisplayName.trim()} style={{ ...primaryStyle, marginTop: '1rem' }}>Join story</button>
            </form>
          </section>
        ) : playToken ? player ? (
          <section className="atelier-reading" lang={recipientLanguage.code} dir={recipientLanguage.dir}>
            {showGiftCover ? <article aria-label="Your gift story" style={{ ...cardStyle, textAlign: 'center', padding: 'clamp(1.5rem, 6vw, 3.5rem) 1rem' }}>
              <p className="atelier-eyebrow">{recipientText.madeForYou}</p>
              <h1 className="atelier-title" style={{ fontSize: 'clamp(2rem, 9vw, 3.5rem)', overflowWrap: 'anywhere' }}>{recipientText.forYou(player.recipientName)}</h1>
              <p>{recipientText.from(player.creatorName)}</p>
              {player.gift?.dedication ? <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, maxWidth: 440, margin: '1.5rem auto', overflowWrap: 'anywhere' }}>{player.gift.dedication}</p> : null}
              <p>{recipientText.duration(player.durationMinutes)}</p>
              <label htmlFor="recipient-story-language">{flow('readerLanguage')}
                <select id="recipient-story-language" value={readerLanguage ?? player.language ?? 'en-US'} disabled={busy} style={fieldStyle}
                  onChange={event => {
                    const language = STORY_LANGUAGES.find(item => item.code === event.target.value)
                    if (!language) return
                    setReaderLanguage(language.code)
                    setTranslationConsent(false)
                    if (sourcePlayer) setPlayer(localizeRecipientPlayer(sourcePlayer, readerTranslation?.language === language.code ? readerTranslation : null))
                  }}>
                  {STORY_LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.label}</option>)}
                </select>
              </label>
              {readerLanguage !== (player.language ?? 'en-US') && !activeReaderTranslation ? <>
                <p>{flow('translationDisclosure')}</p>
                <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'start', textAlign: 'start', padding: '0.75rem 0' }}>
                  <input type="checkbox" checked={translationConsent} disabled={busy} onChange={event => setTranslationConsent(event.target.checked)} />
                  <span>{flow('translationConsent')}</span>
                </label>
              </> : null}
              <button type="button" onClick={() => void startGiftStory()}
                disabled={busy || (readerLanguage !== (player.language ?? 'en-US') && !activeReaderTranslation && !translationConsent)}
                style={{ ...primaryStyle, marginTop: '1rem', minHeight: 48 }}>
                {busy && readerLanguage !== (player.language ?? 'en-US') && !activeReaderTranslation ? flow('translationWorking')
                  : readerLanguage !== (player.language ?? 'en-US') && !activeReaderTranslation ? flow('translateAndStart') : recipientText.openStory}
              </button>
              {player.cooperative ? <p>Muse members use their profile name; guests can join with a display name.</p> : <p style={{ fontSize: '0.9rem' }}>{recipientText.noAccount}</p>}
            </article> : <>
            <h1 className="story-reading-title">{player.title}</h1>
            {player.cooperative ? <section className="atelier-card" aria-label="Cooperative story progress">
              <h2>Playing together</h2>
              <p>Shared progress · Turn {player.cooperative.turnNumber}</p>
              <p>{player.cooperative.isYourTurn
                ? `It is your turn, ${player.cooperative.yourName}.`
                : `Waiting for ${player.cooperative.currentTurnName} to take or pass their turn.`}</p>
              <p>Participants: {player.cooperative.members.map(member => member.displayName).join(', ')}</p>
              {player.cooperative.isYourTurn && !player.solved && !player.skipped ? <button type="button" disabled={busy} onClick={() => void act('cooperative-pass')}>Pass my turn</button> : null}
              <p className="atelier-note">Progress refreshes automatically while this story is open. Turns follow join order; Muse members use their profile name, and guests choose a display name.</p>
            </section> : null}
            <StoryModeControl mode={storyMode} onChange={changeStoryMode} copy={recipientText} language={recipientLanguage.code} direction={recipientLanguage.dir} />
            {storyMode === 'listen' ? <>
              <details><summary>Audio and atmosphere settings</summary><NarrationControls narrator={narrator} beforeSpeak={beforeDeviceListen} /></details>
              {narrator.ambientKind && narrator.ambientKind !== 'none' ? <p role="status">Soundscape: {narrator.ambientKind}</p> : null}
              {narrator.ambientNotice ? <p role="alert">{narrator.ambientNotice}</p> : null}
            </> : null}
            {player.solved || player.skipped ? (
              <article style={cardStyle}>
                {player.endingMode === 'automatic' ? <section aria-label={recipientText.scene(player.sceneIndex + 1, player.sceneCount)}>
                  <p>{recipientText.scene(player.sceneIndex + 1, player.sceneCount)}</p>
                  <h2>{passage(player.scene.title)}</h2>
                  <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{passage(player.scene.body)}</p>
                  {storyMode === 'listen' ? audioButton(`${player.scene.title}. ${player.scene.body}`) : null}
                </section> : null}
                <p><strong>{player.skipped ? recipientText.skipped : player.endingMode === 'automatic' || player.endingMode === 'choice' ? recipientEnding.completed : recipientText.solved}</strong></p>
                <SharedStoryReveal message={player.message} media={player.media ? revealMedia ?? { kind: player.media.kind, state: 'loading' } : null}
                  mode={storyMode} listening={storyMode === 'listen'}
                  narrator={narrator} beforeSpeak={interaction.stopRecording} onMediaError={refreshRevealMedia}
                  onRetryMedia={player.media ? () => void loadRevealMedia(player.media!.kind) : undefined} language={player.language} />
                {player.voice ? <section aria-label="A voice message for you">
                  <h3>{recipientText.voiceTitle}</h3>
                  {voiceUrl ? <audio ref={storedVoiceAudio} controls preload="metadata" src={voiceUrl} onPlay={() => { studioAudio.current?.pause(); narrator.stop(); interaction.stopRecording() }} onError={() => { setVoiceUrl(''); setVoiceError(recipientText.voiceError) }} style={{ maxWidth: '100%' }} aria-label={recipientText.voiceTitle} /> : null}
                  {voiceError ? <p role="alert">{voiceError}</p> : null}
                  <button type="button" style={buttonStyle} onClick={() => void loadVoice()}>{voiceUrl ? recipientText.reloadVoice : recipientText.loadVoice}</button>
                </section> : null}
                {player.adventure?.turn ? <><h3>{recipientText.yourJourney}</h3><p>{passage(player.adventure.turn.narration)}</p><p>{passage(player.adventure.turn.state.progress)}</p></> : null}
                {player.gift?.allowReply ? <details style={{ marginTop: '1.5rem' }}>
                  <summary>{recipientText.reply}</summary>
                  <p>{recipientText.replyPrivacy(player.creatorName)}</p>
                  {replySent ? <p role="status">{recipientText.replySent}</p> : null}
                  <form onSubmit={event => { event.preventDefault(); void sendReply() }}>
                    <label htmlFor="gift-reply">{recipientText.replyLabel}<textarea id="gift-reply" maxLength={1000} required value={replyText} onChange={event => setReplyText(event.target.value)} disabled={busy} rows={3} style={fieldStyle} /></label>
                    <button type="submit" disabled={busy || !replyText.trim()} style={{ ...primaryStyle, marginTop: 12 }}>{replySent ? recipientText.updateReply : recipientText.sendReply}</button>
                  </form>
                </details> : null}
              </article>
            ) : (
              <>
              {player.adventure ? <article style={cardStyle}>
                <p>{recipientText.scene(player.sceneIndex + 1, player.sceneCount)}</p>
                <h2>{passage(player.scene.title)}</h2>
                <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{passage(player.scene.body)}</p>
                <p><strong>{recipientText.clue}:</strong> {passage(player.scene.clue)}</p>
                {player.adventure.turn ? <section>
                  <h3>{recipientText.yourJourney}</h3>
                  <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{passage(player.adventure.turn.narration)}</p>
                </section> : null}
                {player.adventure.turnTaking ? <p role="status" style={{ fontWeight: 700 }}>
                  {player.adventure.actionsUsed % 2 === 0 ? player.recipientName : player.creatorName}&apos;s turn. Pass the device so you can choose together.
                </p> : null}
                {storyMode === 'listen' ? <details open><summary>Device voice (optional, quality varies)</summary>
                  <p>Prepared cloud recordings do not cover live adventure turns. This option uses your phone&apos;s voice, not Google narration.</p>
                  <NarrationButton narrator={narrator} text={player.adventure.turn?.narration || `${player.scene.body} ${player.scene.clue}`} label={recipientText.playAdventure} beforeSpeak={beforeDeviceListen} />
                </details> : null}
                <details style={{ margin: '1rem 0' }}><summary>{recipientText.yourJourney}</summary>
                <p>{recipientText.adventureBudget(player.adventure.actionsRemaining, player.adventure.budgetRemaining, player.adventure.budget)}</p>
                <p>{recipientText.actionCost}</p>
                {player.adventure.turn ? <section aria-label="Adventure state">
                  <p>{player.adventure.turn.state.progress}</p>
                  {(['inventory', 'discoveries', 'relationships'] as const).map(key => <div key={key}><h4>{recipientText.adventureStateLabels[key]}</h4><ul>{player.adventure!.turn!.state[key].map(item => <li key={item}>{item}</li>)}</ul></div>)}
                </section> : null}
                </details>
                {adventureCanSubmit ? <ExplicitConsent checked={aiConsent} onChange={setAiConsent}>
                  {recipientText.aiActionConsent}
                </ExplicitConsent> : null}
                {adventureCanSubmit ? player.adventure.choiceMode === 'suggested' ? <section aria-label="Suggested actions">
                  <h3>{recipientText.yourAction}</h3>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>{player.adventure.choices?.map(choice => <button key={choice} disabled={busy || player.adventure?.pending || Boolean(player.cooperative && !player.cooperative.isYourTurn)} onClick={() => void adventureAction(false, choice)} style={{ ...buttonStyle, textAlign: 'start' }}>{choice}</button>)}</div>
                  {!player.adventure.choices?.length && !player.adventure.pending ? <p>{recipientText.refreshProgress}</p> : null}
                </section> : <form onSubmit={event => { event.preventDefault(); void adventureAction() }}>
                  <label htmlFor="adventure-action">{recipientText.yourAction}<textarea id="adventure-action" value={actionText} onFocus={() => interaction.cancelRecording()} onChange={event => { interaction.cancelRecording(); setActionText(event.target.value); setAiConsent(false) }} maxLength={800} rows={3} style={fieldStyle} disabled={busy || !recipientDraft.ready || Boolean(player.cooperative && !player.cooperative.isYourTurn)} /></label>
                  <p>{recipientText.reviewGuess}</p>
                  <DictationButton label={recipientText.dictateAction} stopLabel={recipientText.stopDictation} stoppingLabel={recipientText.finishingDictation} disabled={busy || Boolean(interaction.stoppingTarget) || Boolean(player.cooperative && !player.cooperative.isYourTurn)} recording={interaction.recordingTarget === 'adventure-action' || interaction.stoppingTarget === 'adventure-action'} stopping={interaction.stoppingTarget === 'adventure-action'} onStart={() => interaction.dictate('adventure-action', value => { setActionText(value.slice(0, 800)); setAiConsent(false) })} onStop={() => interaction.stopRecording('adventure-action')} style={buttonStyle} />
                  {interaction.stoppingTarget === 'adventure-action' ? <p role="status">{recipientText.finishingDictation}</p> : interaction.recordingTarget === 'adventure-action' ? <p role="status">{interaction.ready ? recipientText.listening : recipientText.startingMicrophone}</p> : null}
                  <button disabled={busy || !recipientDraft.ready || Boolean(player.adventure.pending) || !actionText.trim() || Boolean(player.cooperative && !player.cooperative.isYourTurn)} style={primaryStyle}>{recipientText.submitAction}</button>
                </form> : player.cooperative && !player.cooperative.isYourTurn
                  ? <p role="status">Waiting for {player.cooperative.currentTurnName} to take or pass their turn.</p>
                  : <p>{player.adventure.budgetRemaining <= 0 ? recipientText.noBudget : recipientText.noActions}</p>}
                {player.adventure.pending ? <p role="status">{recipientText.pendingAction}</p> : null}
                {player.sceneIndex + 1 < player.sceneCount ? <>
                  <p>{recipientText.scene(player.sceneIndex + 1, player.sceneCount)}</p>
                  <button type="button" disabled={busy || player.adventure.pending || Boolean(player.cooperative && !player.cooperative.isYourTurn)} onClick={() => void act('next')} style={{ ...primaryStyle, marginTop: '1rem' }}>{recipientEnding.continueScenes}</button>
                </> : null}
              </article> : <article style={cardStyle}>
                  <p>{recipientText.scene(player.sceneIndex + 1, player.sceneCount)}</p>
                  <h2>{passage(player.scene.title)}</h2>
                    <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{passage(player.scene.body)}</p>
                    <p style={{ lineHeight: 1.7 }}><strong>{recipientText.clue}:</strong> {passage(player.scene.clue)}</p>
                  {storyMode === 'listen' ? <>
                  <StudioNarration key={`${playToken}:${sessionToken}:${player.sceneIndex}`} sceneIndex={player.sceneIndex} audioRef={studioAudio}
                          playRequest={studioPlayRequest}
                          ambientText={`${player.scene.title}. ${player.scene.body} ${player.scene.clue}`}
                          onReadAlong={(position, active) => setStudioReadAlong({ text: `${player.scene.title}. ${player.scene.body} ${player.scene.clue}`, position, active })}
                          voiceVolume={narrator.immersive.voiceVolume}
                          onAmbientStart={narrator.startAmbientFor} onAmbientPause={narrator.pauseAmbient} onAmbientStop={narrator.stopAmbient}
                          disabled={busy} stopSignal={narrator.busy || Boolean(interaction.recordingTarget)} beforeListen={beforeStudio}
                    load={(sceneIndex, signal) => requestStudioAudio({ action: 'studio-audio', token: playToken, sessionToken, sceneIndex, ...(romanceAccepted ? { romanceConfirmed: true } : {}) }, signal)} />
                  <details><summary>Device voice (optional, quality varies)</summary>
                    <NarrationButton narrator={narrator} text={`${player.scene.title}. ${player.scene.body} ${player.scene.clue}`} label={recipientText.playScene} beforeSpeak={beforeDeviceListen} />
                  </details>
                  </> : null}
                  {player.sceneIndex + 1 < player.sceneCount ? <>
                    <h3>{recipientText.next}</h3>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {(player.scene.choices || [recipientText.next]).map(choice => <button key={choice} disabled={busy} onClick={() => void act('next')} style={{ ...buttonStyle, textAlign: 'start' }}>{choice}</button>)}
                    </div>
                  </> : <p>{player.endingMode === 'choice' ? recipientEnding.chooseFinal : recipientText.tryAnswer}</p>}
                </article>}
                {player.discoveries.length > 0 ? (
                  <details style={cardStyle}>
                    <summary>{recipientText.earlier} ({player.discoveries.length})</summary>
                    {player.discoveries.map((scene, index) => (
                      <article key={index}>
                        <h3>{passage(scene.title)}</h3>
                        <p style={{ lineHeight: 1.8 }}>{passage(scene.body)}</p>
                        <p><strong>{recipientText.clue}:</strong> {passage(scene.clue)}</p>
                        {audioButton(`${scene.body} ${scene.clue}`)}
                      </article>
                    ))}
                  </details>
                ) : null}
                {player.sceneIndex + 1 === player.sceneCount && (player.endingMode ?? 'answer') === 'answer' ? <form onSubmit={(event) => { event.preventDefault(); void act('guess') }} style={cardStyle}>
                  {player.answerInstruction ? <p role="note">{player.answerInstruction}</p> : null}
                  <label style={{ fontWeight: 700 }}>{player.answerType === 'clue' ? 'What did you find?' : player.answerType === 'word' ? 'Say the final word' : player.answerType === 'action' ? 'Describe the action' : 'Say the final phrase'}<input value={guess} onFocus={() => interaction.cancelRecording()} onChange={(event) => { interaction.cancelRecording(); setGuess(event.target.value) }} maxLength={200} required style={fieldStyle} disabled={busy || !recipientDraft.ready || Boolean(player.cooperative && !player.cooperative.isYourTurn)} /></label>
                  <p>{recipientText.guessHelp} {player.canSkip ? recipientText.skipHelp : recipientText.solveHelp}</p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button disabled={busy || !recipientDraft.ready || !guess.trim() || Boolean(player.cooperative && !player.cooperative.isYourTurn)} style={primaryStyle}>{recipientText.tryAnswer}</button>
                    <DictationButton label={recipientText.dictateAnswer} stopLabel={recipientText.stopDictation} stoppingLabel={recipientText.finishingDictation} disabled={busy || !recipientDraft.ready || Boolean(interaction.stoppingTarget) || Boolean(player.cooperative && !player.cooperative.isYourTurn)} recording={interaction.recordingTarget === 'guess' || interaction.stoppingTarget === 'guess'} stopping={interaction.stoppingTarget === 'guess'} onStart={() => interaction.dictate('guess', (value) => setGuess(value.slice(0, 200)))} onStop={() => interaction.stopRecording('guess')} style={buttonStyle} />
                  </div>
                  <p>{recipientText.reviewGuess}</p>
                  {interaction.stoppingTarget === 'guess' ? <p role="status">{recipientText.finishingDictation}</p> : interaction.recordingTarget === 'guess' ? <p role="status">{interaction.ready ? recipientText.listening : recipientText.startingMicrophone}</p> : null}
                </form> : null}
                {player.sceneIndex + 1 === player.sceneCount && player.endingMode === 'choice' ? <section style={cardStyle} aria-label={recipientEnding.chooseFinal}>
                  <h2>{recipientEnding.chooseFinal}</h2>
                  {player.answerInstruction ? <p>{player.answerInstruction}</p> : null}
                  <div style={{ display: 'grid', gap: '0.75rem' }}>{player.endingChoices?.map((choice, index) => <button key={choice} type="button" disabled={busy || Boolean(player.cooperative && !player.cooperative.isYourTurn)} onClick={() => void act('ending-choice', index)} style={buttonStyle}>{choice}</button>)}</div>
                </section> : null}
              </>
            )}
            {!player.solved && !player.skipped ? <details style={cardStyle}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{recipientText.needHelp}</summary>
              <p>{recipientText.pauseHelp}</p>
              <p>{recipientText.contactSender(player.creatorName)}</p>
              {player.canSkip ? <>
                <p>{recipientText.skipHelp}</p>
                <button disabled={busy || Boolean(player.cooperative && !player.cooperative.isYourTurn)} onClick={() => void act('skip')} style={buttonStyle}>{recipientText.skip}</button>
              </> : (player.endingMode ?? 'answer') === 'answer' ? <p>{recipientText.solveHelp}</p> : null}
              {!player.hintsRemaining && !player.revealedHints.length ? <p>{recipientText.noHints}</p> : null}
            </details> : null}
            {(player.revealedHints.length > 0 || (!player.solved && !player.skipped && player.hintsRemaining > 0)) ? (
              <details style={cardStyle}>
                <summary>{recipientText.hintTitle}</summary>
                {player.revealedHints.length > 0 ? (
                  <ol>{player.revealedHints.map((hint, index) => <li key={index} style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{hint}</li>)}</ol>
                ) : <p>{recipientText.hintsNoCost}</p>}
                {!player.solved && !player.skipped && player.hintsRemaining > 0 ? (
                  <button disabled={busy || Boolean(player.cooperative && !player.cooperative.isYourTurn)} onClick={() => void act('hint')} style={buttonStyle}>{recipientText.showHint} ({recipientText.hintRemaining(player.hintsRemaining)})</button>
                ) : player.hintsRemaining === 0 ? <p>{recipientText.hintsExhausted}</p> : null}
              </details>
            ) : null}
            {player.feedback ? <p role="status">{player.feedback}</p> : null}
            <details lang="en" dir="ltr" style={{ marginTop: '1rem' }}>
              <summary>About this private story</summary>
              <p>{recipientText.storyFrom(player.creatorName, player.recipientName)}</p>
              <p>{player.description}</p>
              <p>{player.cooperative
                ? 'Cooperative participants can see one shared progress state, participant display names, and whose turn is next.'
                : 'The sender can see anonymous playthrough counts, the furthest prepared scene reached, and whether the mystery was solved or revealed without solving. This does not identify you.'} <Link href="/privacy">Privacy</Link></p>
              <p>{recipientText.settingsDisclosure}</p>
            </details>
            </>}
          </section>
        ) : <p>Could not open the story. Check the link or ask its creator for a new one.</p> : creator ? (
          <section>
            <p className="atelier-eyebrow">Private creator preview</p>
            <h1>{creator.content.title}</h1>
            {creator.brief.romance ? <p>{romanceCopy(interfaceLanguage).title(creator.brief.romance)}. {flow('romanceRecipientNotice')}</p> : null}
            <StoryModeControl mode={storyMode} onChange={changeStoryMode} copy={interfaceCopy} language={interfaceLanguage} direction={storyLanguage(interfaceLanguage).dir} />
            {storyMode === 'listen' ? <article style={cardStyle} aria-label="Listen before sending">
              <h2>Listen before sending</h2>
              {!creator.brief.adventure ? <>
                <p>Prepare a consistent-quality recording for each scene. Recipients can replay it without generating audio again.</p>
                <label>Preview scene<select value={Math.min(studioScene, creator.content.scenes.length - 1)} onChange={event => { studioAudio.current?.pause(); narrator.stop(); setStudioScene(Number(event.target.value)) }} style={fieldStyle}>
                  {creator.content.scenes.map((scene, index) => <option key={index} value={index}>Scene {index + 1}: {scene.title}</option>)}
                </select></label>
                <StudioNarration key={`${creator.ownerToken}:${Math.min(studioScene, creator.content.scenes.length - 1)}`}
                  playRequest={studioPlayRequest}
                  ambientText={`${creator.content.scenes[Math.min(studioScene, creator.content.scenes.length - 1)].title}. ${creator.content.scenes[Math.min(studioScene, creator.content.scenes.length - 1)].body} ${creator.content.scenes[Math.min(studioScene, creator.content.scenes.length - 1)].clue}`}
                  onAmbientStart={narrator.startAmbientFor} onAmbientPause={narrator.pauseAmbient} onAmbientStop={narrator.stopAmbient}
                  onReadAlong={(position, active) => {
                    const scene = creator.content.scenes[Math.min(studioScene, creator.content.scenes.length - 1)]
                    setStudioReadAlong({ text: `${scene.title}. ${scene.body} ${scene.clue}`, position, active })
                  }}
                  sceneIndex={Math.min(studioScene, creator.content.scenes.length - 1)} owner audioRef={studioAudio}
                  voiceVolume={narrator.immersive.voiceVolume}
                  disabled={busy || voiceRecording || voiceUploading} stopSignal={narrator.busy || Boolean(interaction.recordingTarget) || voiceRecording} beforeListen={beforeStudio}
                  check={async (sceneIndex, signal) => studioSceneStatus(await request<StudioResponse>({ action: 'studio-status', token: creator.ownerToken }, signal), sceneIndex)}
                  generate={async (sceneIndex, signal) => studioSceneStatus(await request<StudioResponse>({ action: 'studio-generate', token: creator.ownerToken, sceneIndex, consentVersion: MUSE_AI_CONSENT_VERSION }, signal), sceneIndex)}
                  load={(sceneIndex, signal) => requestStudioAudio({ action: 'studio-audio', token: creator.ownerToken, preview: true, sceneIndex }, signal)} />
              </> : <p>Live AI scenes cannot use prepared Studio recordings. Free device speech is available below; its quality depends on your device.</p>}
              <details>
                <summary>Use free device voice instead</summary>
                <NarrationButton narrator={narrator} text={sharedStoryPreviewText(creator.content)} label="Listen with device voice (quality varies)" beforeSpeak={beforeDeviceListen} />
                <details><summary>Device voice and background settings</summary><NarrationControls narrator={narrator} beforeSpeak={beforeDeviceListen} /></details>
              </details>
              <details><summary>Audio and atmosphere settings</summary><NarrationControls narrator={narrator} beforeSpeak={beforeDeviceListen} /></details>
              {narrator.ambientKind && narrator.ambientKind !== 'none' ? <p role="status">Soundscape: {narrator.ambientKind}</p> : null}
              {narrator.ambientNotice ? <p role="alert">{narrator.ambientNotice}</p> : null}
            </article> : null}
            <details open style={cardStyle} aria-label="Read prepared story">
            <summary>Read the story · {creator.content.scenes.length} scenes</summary>
            {storyMode === 'read' ? <p>{creator.content.description}</p> : null}
            {creator.content.scenes.map((scene, index) => (
              <article key={index} style={cardStyle} aria-label={`Story scene ${index + 1}`}>
                <h2>{passage(scene.title)}</h2>
                <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{passage(scene.body)}</p>
                <p><strong>Clue:</strong> {passage(scene.clue)}</p>
                {storyMode === 'listen' ? <details><summary>Listen to this scene</summary>{audioButton(`${scene.body} ${scene.clue}`)}</details> : null}
              </article>
            ))}
            </details>
            {!creator.brief.message && !ownerMedia
              ? <p role="status" style={cardStyle}>Attach a photo or video in sender tools to complete the story before sharing.</p>
              : shareDetails ? <div id="gift-story-share" style={{ marginTop: '1rem' }}>
                <ShareGiftStory recipientUrl={shareDetails.url} shareText={shareDetails.text} expiresAt={creator.expiresAt}
                  disabled={busy || voiceRecording || voiceUploading || Boolean(mediaFile || voiceFile) || upload.phase === 'uploading'} localOnly={shareDetails.localOnly}
                  whatsappUrl={shareDetails.whatsappUrl} buttonLabel="Share your story" beforeShare={confirmShareReady}
                  onShareStart={() => narrator.stop()} previewContent={<GiftStoryPreview brief={creator.brief} content={creator.content} />} />
              </div> : null}
            <details style={{ marginTop: '1rem' }} aria-label="Sender tools">
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Share and sender tools</summary>
            <p>For {creator.brief.recipientName} - about {creator.brief.durationMinutes} minutes.</p>
            <p>{creation.endingHelp}</p>
            <p>{creator.brief.endingMode === 'automatic' ? creation.automaticHelp : creator.brief.endingMode === 'choice' ? creation.choiceHelp : creator.brief.unlockPolicy === 'allow-skip' ? 'At the final scene, recipients may confirm a reveal without solving.' : creation.answerHelp}</p>
            <p>{creator.expiresAt === null ? 'Recipient access has no automatic expiry.' : `Recipient access expires ${new Date(creator.expiresAt).toLocaleString()}.`} The brief stays in this browser&apos;s library until removed, whether or not anyone finishes.</p>
            {creator.brief.adventure ? <p>{creator.brief.adventure.choiceMode === 'suggested' ? '3-5 suggested actions per turn' : 'Free written or spoken actions'}. Up to 12 per playthrough; {creator.brief.adventure.actionBudget} total AI attempts, including failures.</p> : null}
            {creator.content.scenes.map((scene, index) => (
              <details key={index} style={cardStyle}>
                <summary style={{ cursor: 'pointer' }}>Scene {index + 1}: {scene.title}</summary>
                {creator.brief.adventure ? <p>AI adapts this clue to the recipient&apos;s actions.</p> : index + 1 < creator.content.scenes.length ? <>
                  <h3>Recipient exploration actions</h3>
                  <ul>{(scene.choices || ['Follow the next clue', 'Continue exploring the mystery', 'Look for another detail']).map(choice => <li key={choice}>{choice}</li>)}</ul>
                  <p>All actions continue to the same next scene.</p>
                </> : <p>{creator.brief.endingMode === 'automatic' ? creation.automaticHelp : creator.brief.endingMode === 'choice' ? creation.choiceHelp : creation.answerHelp}</p>}
              </details>
            ))}
            <details style={cardStyle}>
              <summary>Private ending details</summary>
              <p><strong>{creation.ending}:</strong> {creator.brief.endingMode === 'automatic' ? creation.automatic : creator.brief.endingMode === 'choice' ? creation.choice : creation.answer}</p>
              {creator.brief.answerInstruction ? <p><strong>Where/how:</strong> {creator.brief.answerInstruction}</p> : null}
              {(creator.brief.endingMode ?? 'answer') === 'answer' ? <p><strong>Answer:</strong> {creator.brief.solution}</p> : null}
              {creator.brief.endingMode === 'choice' ? <ul>{creator.brief.endingChoices?.map(choice => <li key={choice}>{choice}</li>)}</ul> : null}
              {(creator.brief.alternativeAnswers ?? []).length > 0 ? (
                <><h3>Other valid answers</h3><ul>{creator.brief.alternativeAnswers!.map((answer, index) => <li key={index}>{answer}</li>)}</ul></>
              ) : null}
              {(creator.brief.assistanceHints ?? []).length > 0 ? (
                <><h3>Hints, in reveal order</h3><ol>{creator.brief.assistanceHints!.map((hint, index) => <li key={index}>{hint}</li>)}</ol><p>Shown only when requested.</p></>
              ) : null}
              {creator.brief.message ? <>
                <h3>Final message</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{creator.brief.message}</p>
                <NarrationButton narrator={narrator} text={creator.brief.message} label="Preview the final message" beforeSpeak={beforeDeviceListen} context={{ progress: 1, ending: true }} />
              </> : <p>Photo or video reveal only.</p>}
              <section aria-label="Final photo or video" style={{ marginTop: '1rem' }}>
                <h3>Final photo or video</h3>
                {ownerMedia ? <>
                  <p>Private {mediaLabel(ownerMedia.kind)} ({formatMediaSize(ownerMedia.size)}). Revealed after a correct answer; no autoplay.</p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button type="button" disabled={busy || ownerPreview?.state === 'loading'} onClick={() => void previewMedia()} style={buttonStyle}>Preview {mediaLabel(ownerMedia.kind)}</button>
                    <button type="button" disabled={busy || upload.phase === 'uploading'} onClick={() => void removeMedia()} style={buttonStyle}>Remove {mediaLabel(ownerMedia.kind)}</button>
                  </div>
                  {ownerPreview ? <SharedStoryReveal media={ownerPreview} narrator={narrator} beforeSpeak={interaction.stopRecording}
                    onMediaError={() => void previewMedia()} onRetryMedia={() => void previewMedia()} /> : null}
                </> : <p>{creator.brief.message ? 'Add a photo or video (optional).' : 'Attach a photo or video to unlock sharing.'}</p>}
                <label style={{ display: 'block', marginTop: '0.75rem' }}>{ownerMedia ? 'Replace with another file' : 'Choose a photo or video'}
                  <input type="file" accept={SHARED_MEDIA_ACCEPT} disabled={busy || upload.phase === 'uploading'} onChange={event => { chooseFile(event.target.files?.[0] ?? null); event.target.value = '' }} style={fieldStyle} />
                </label>
                {mediaFile ? <p>Selected: {mediaFile.name} ({formatMediaSize(mediaFile.size)})</p> : null}
                {upload.phase === 'uploading' ? <p role="status">Uploading privately… {upload.progress}%</p> : null}
                {upload.phase === 'failed' ? <p role="alert" style={{ color: '#a14329' }}>{upload.error}</p> : null}
                {mediaFile && upload.phase !== 'uploading' ? <button type="button" disabled={busy} onClick={() => { setBusy(true); void uploadMedia(creator, mediaFile).finally(() => setBusy(false)) }} style={primaryStyle}>
                  {upload.phase === 'failed' ? 'Retry upload' : ownerMedia ? 'Upload replacement' : 'Upload file'}
                </button> : null}
                <p>JPEG/PNG/WebP: {formatMediaSize(SHARED_MEDIA_PHOTO_MAX_BYTES)} max. MP4/WebM: {formatMediaSize(SHARED_MEDIA_VIDEO_MAX_BYTES)} max. No AI upload or regeneration.</p>
              </section>
              <details style={{ marginTop: '1rem' }}>
                <summary>Your voice message (optional)</summary>
                {ownerVoice ? <>
                  <p>One private recording attached. Unlocks with the final reveal.</p>
                  <button type="button" disabled={busy || voiceUploading} onClick={() => void loadVoice(true)} style={buttonStyle}>Preview stored recording</button>
                  <button type="button" disabled={busy || voiceUploading} onClick={() => void removeVoice()} style={buttonStyle}>Remove stored recording</button>
                  {voiceUrl ? <audio ref={storedVoiceAudio} controls src={voiceUrl} preload="metadata" aria-label="Stored voice preview" onPlay={() => { studioAudio.current?.pause(); narrator.stop() }} onError={() => setVoiceError('Could not play this recording. Try reloading the preview.')} style={{ display: 'block', maxWidth: '100%', marginTop: 12 }} /> : null}
                </> : null}
                <GiftVoiceRecorder file={voiceFile} onChange={setVoiceFile} disabled={busy || voiceUploading} onActiveChange={setVoiceRecording} beforeRecord={() => { studioAudio.current?.pause(); storedVoiceAudio.current?.pause(); narrator.stop(); interaction.stopRecording() }} />
                {voiceError ? <p role="alert">{voiceError}</p> : null}
                {voiceUploading ? <p role="status">Uploading your voice message privately...</p> : voiceFile ? <button type="button" disabled={busy || voiceRecording} onClick={() => void uploadVoice(creator, voiceFile)} style={primaryStyle}>{ownerVoice ? 'Upload replacement recording' : 'Attach recording'}</button> : null}
              </details>
            </details>
            {creator.brief.gift?.allowReply ? <details style={cardStyle}>
              <summary>Private replies ({replies.length})</summary>
              <p>Only messages recipients choose to send. Recipient identities are not verified.</p>
              <button type="button" disabled={busy} style={buttonStyle} onClick={() => void refreshReplies()}>Refresh replies</button>
              {!replies.length ? <p>No replies yet.</p> : replies.map((reply, index) => <article key={index} style={{ borderTop: '1px solid #d9cfc5', marginTop: 12 }}>
                <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{reply.message}</p>
                <p><small>{new Date(reply.createdAt).toLocaleString()}</small></p>
                <button type="button" disabled={busy} style={buttonStyle} onClick={() => {
                  setFollowUpReply(reply)
                  setFollowUpDirection('')
                  setFollowUpGoal('')
                  setFollowUpSolution('')
                  setFollowUpMessage('I loved reading your reply. I made this next chapter for you.')
                  setFollowUpConsent(false)
                  setFollowUpRomanceConfirmed(false)
                  setError('')
                }}>Use this reply for a follow-up</button>
                {followUpReply?.createdAt === reply.createdAt && followUpReply.message === reply.message ? <section aria-label="Create follow-up story" style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #d9cfc5', borderRadius: 12 }}>
                  <h3>Continue from their reply</h3>
                  <p>This creates a separate new gift story. The reply and previous ending are sent to AI only for this generation, after your explicit consent. The original story and reply stay unchanged.</p>
                  <label style={{ display: 'block', fontWeight: 700 }}>What should the next chapter explore?
                    <textarea id="follow-up-direction" value={followUpDirection} onChange={event => setFollowUpDirection(event.target.value)} maxLength={600} rows={3} style={fieldStyle} disabled={busy} />
                  </label>
                  <label style={{ display: 'block', fontWeight: 700 }}>What should they discover?
                    <input id="follow-up-goal" value={followUpGoal} onChange={event => setFollowUpGoal(event.target.value)} maxLength={600} style={fieldStyle} disabled={busy} />
                  </label>
                  <label style={{ display: 'block', fontWeight: 700 }}>New secret answer
                    <input id="follow-up-solution" value={followUpSolution} onChange={event => setFollowUpSolution(event.target.value)} maxLength={200} style={fieldStyle} disabled={busy} />
                  </label>
                  <label style={{ display: 'block', fontWeight: 700 }}>Message after the reveal
                    <textarea id="follow-up-message" value={followUpMessage} onChange={event => setFollowUpMessage(event.target.value)} maxLength={2000} rows={3} style={fieldStyle} disabled={busy} />
                  </label>
                  {creator.brief.romance && !permissions.managed ? <label style={{ display: 'block', padding: '0.75rem 0' }}>
                    <input type="checkbox" checked={followUpRomanceConfirmed} onChange={event => setFollowUpRomanceConfirmed(event.target.checked)} disabled={busy} /> I confirm the existing romance boundaries for this new story.
                  </label> : null}
                  {creator.brief.romance && permissions.managed && !permissions.romance ? <p role="alert"><a href="/account">{registrationCopy(interfaceLanguage).settings}</a></p> : null}
                  <ExplicitConsent checked={followUpConsent} onChange={setFollowUpConsent}>
                    I reviewed this reply and consent to sending it, the previous story ending, and the new story details to the AI provider to create this follow-up.
                  </ExplicitConsent>
                  <button type="button" style={primaryStyle} disabled={busy || !followUpDirection.trim() || !followUpGoal.trim() || !followUpSolution.trim() || !followUpMessage.trim() || !hasExplicitConsent(followUpConsent) || Boolean(creator.brief.romance && !followUpRomanceConfirmed)} onClick={() => void createFollowUpStory()}>
                    {busy ? 'Creating follow-up…' : 'Create follow-up story'}
                  </button>
                  <button type="button" style={buttonStyle} disabled={busy} onClick={() => { setFollowUpReply(null); setFollowUpConsent(false); setFollowUpRomanceConfirmed(false) }}>Cancel</button>
                </section> : null}
              </article>)}
            </details> : null}
            <details style={cardStyle}>
              <summary>Local testing: HTTPS tunnel</summary>
              <p>Start the recipient gateway and Cloudflare Quick Tunnel, then paste its HTTPS address. Keep Muse running and this computer awake. Restarting changes the address; it is not saved. Use non-sensitive stories: traffic passes through Cloudflare.</p>
              <label>Temporary tunnel address<input type="url" value={tunnelAddress} placeholder="https://your-tunnel.trycloudflare.com" onChange={event => setTunnelAddress(event.target.value)} style={fieldStyle} /></label>
              <button style={{ ...buttonStyle, marginTop: '0.75rem' }} onClick={() => {
                try {
                  const url = new URL(tunnelAddress.trim())
                  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.trycloudflare\.com$/.test(url.hostname) || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
                    throw new Error('Paste only the HTTPS trycloudflare.com address printed by your running tunnel.')
                  }
                  setPublicOrigin(url.origin)
                  setError('')
                  setNotice('Recipient sharing now uses the temporary public address. Management stays local.')
                } catch (error) {
                  setError(error instanceof Error ? error.message : 'Invalid tunnel address.')
                }
              }}>Use tunnel for recipient links</button>
              {publicOrigin ? <><p role="status">Temporary recipient address: {publicOrigin}</p><button style={buttonStyle} onClick={() => { setPublicOrigin(''); setTunnelAddress(''); setNotice('Recipient links now use the local address again.') }}>Return to local links</button></> : null}
            </details>
            <button disabled={busy} onClick={() => creatorAction('share')} style={{ ...buttonStyle, marginTop: '1rem' }}>Replace recipient link (invalidates the previous one)</button>
            <details style={{ marginTop: '1.5rem' }}>
              <summary>Delete this story</summary>
              <p>This permanently removes the story and disables both links.</p>
              <button disabled={busy || voiceUploading || voiceRecording} onClick={() => creatorAction('delete')} style={buttonStyle}>Permanently delete story</button>
            </details>
            </details>
          </section>
        ) : (
          <section>
            <p className="atelier-eyebrow">{pageText('giftEyebrow', interfaceLanguage)}</p>
            <h1 className="atelier-title" style={{ fontSize: 'clamp(2.2rem, 6vw, 3.6rem)' }}>{pageText('giftTitle', interfaceLanguage)}</h1>
            <p style={cardStyle}>{giftFormText('giftAllowanceNote', interfaceLanguage)}</p>
            {pendingDraft ? <aside style={cardStyle} aria-label="Saved draft">
              <h2>Pick up where you left off?</h2>
              <p>A draft is saved on this device from {new Date(pendingDraft.savedAt).toLocaleString()}. Voice recordings and media are not saved in drafts.</p>
              <button type="button" style={primaryStyle} onClick={() => {
                setBrief(pendingDraft.brief); setAssistanceHintsText(pendingDraft.assistanceHintsText); setAlternativeAnswersText(pendingDraft.alternativeAnswersText); setCreatorStep(0)
                setPendingDraft(null); setAiConsent(false)
              }}>Restore draft</button>
              <button type="button" style={buttonStyle} onClick={() => {
                try {
                  removeGiftDraft()
                  setPendingDraft(null)
                  setBrief({ ...blankBrief })
                  setAiConsent(false)
                  applyStoryPreferences()
                  setDraftStatus('Draft discarded.')
                } catch { setDraftStatus('Could not discard the saved draft. Check browser storage access.') }
              }}>Discard saved draft</button>
            </aside> : null}
            {draftStatus ? <p role="status" style={{ fontSize: '0.9rem' }}>{draftStatus}</p> : null}
            {draftReady && !pendingDraft && !draftUnreadable ? <details style={{ marginBottom: '1rem' }}>
              <summary>{flow('draftPrivacy')}</summary>
              <p>{flow('draftPrivacyNote')}</p>
              <button type="button" disabled={busy || voiceRecording} style={buttonStyle} onClick={() => {
                if (!window.confirm('Discard this draft and clear the form? Attached files and recordings will also be removed from this page. Existing sent stories are unchanged.')) return
                try {
                  removeGiftDraft()
                  setBrief({ ...blankBrief }); setAssistanceHintsText(''); setAlternativeAnswersText(''); setCreatorStep(0)
                  setVoiceFile(null); setMediaFile(null); setAiConsent(false); applyStoryPreferences(); setDraftStatus('Draft discarded.')
                } catch { setDraftStatus('Could not discard the draft. Check browser storage access.') }
              }}>Discard draft and clear form</button>
            </details> : null}
            {draftUnreadable ? <button type="button" style={buttonStyle} onClick={() => {
              try {
                removeGiftDraft()
                setDraftUnreadable(false)
                setBrief({ ...blankBrief })
                applyStoryPreferences()
                setDraftStatus('Unreadable draft discarded.')
              } catch { setDraftStatus('Could not discard the saved draft. Check browser storage access.') }
            }}>Discard unreadable draft</button> : null}
            <ol aria-label="Story creation steps" style={{ display: 'flex', gap: '0.5rem', listStyle: 'none', padding: 0, margin: '1.5rem 0 0.75rem' }}>
              {(['stepFor', 'stepStory', 'stepSurprise'] as const).map((key, index) => {
                const label = index === 2 ? creation.stepEnding : giftFormText(key, interfaceLanguage)
                return <li key={key} aria-current={creatorStep === index ? 'step' : undefined} style={{ flex: 1, borderTop: `3px solid ${creatorStep === index ? '#70566d' : '#e4dcd4'}`, paddingTop: '0.65rem', color: creatorStep === index ? '#202c42' : '#70566d', fontSize: '0.85rem', fontWeight: creatorStep === index ? 700 : 400 }}>{index + 1}. {label}</li>
              })}
            </ol>
            <p className="atelier-eyebrow" aria-live="polite">{creatorStep + 1}/3 · {creatorStep === 2 ? creation.stepEnding : giftFormText((['stepFor', 'stepStory'] as const)[creatorStep], interfaceLanguage)}</p>
            <form ref={creatorForm} onSubmit={generate} className="gift-story-form">
              <fieldset hidden={creatorStep !== 0} disabled={busy || creatorStep !== 0} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              <div style={cardStyle}>
                <h2>1. {giftFormText('whoFor', interfaceLanguage)}</h2>
                <fieldset aria-label={creation.participants} style={{ border: 0, padding: 0, marginBottom: '1.25rem' }}>
                  <legend>{creation.participants}</legend>
                  {(['recipient', 'together'] as const).map(value => <label key={value} style={{ display: 'flex', gap: '0.75rem', padding: '0.85rem', border: '1px solid var(--line)', borderRadius: 12, marginBlock: '0.5rem' }}>
                    <input type="radio" name="story-participants" value={value} checked={(brief.participants ?? 'recipient') === value} onChange={() => {
                      updateBrief(current => ({ ...current, participants: value, ...(current.adventure ? { adventure: { actionBudget: current.adventure.actionBudget, choiceMode: current.adventure.choiceMode } } : {}) }))
                      setAiConsent(false)
                    }} />
                    <span><strong>{value === 'recipient' ? creation.recipientOnly : creation.together}</strong><br />{value === 'recipient' ? creation.recipientOnlyHelp : creation.togetherHelp}</span>
                  </label>)}
                </fieldset>
                {brief.participants === 'together' ? <p>{creation.participantsNote}</p> : null}
                <p>{giftFormText('chooseMoment', interfaceLanguage)}</p>
                <div role="group" aria-label="Choose an occasion" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: '1.2rem' }}>
                  {GIFT_OCCASIONS.map(occasion => <button key={occasion.id} type="button" disabled={busy} aria-pressed={brief.gift?.occasion === occasion.id} onClick={() => chooseOccasion(occasion.id)} style={brief.gift?.occasion === occasion.id ? primaryStyle : buttonStyle}>{giftFormText(giftOccasionLabels[occasion.id], interfaceLanguage)}</button>)}
                  <button type="button" disabled={busy} aria-pressed={!brief.gift} onClick={() => chooseOccasion()} style={!brief.gift ? primaryStyle : buttonStyle}>{giftFormText('ownIdea', interfaceLanguage)}</button>
                </div>
                {textField('creatorName', giftFormText('yourName', interfaceLanguage), '', 80)}
                {textField('recipientName', giftFormText('recipientName', interfaceLanguage), '', 80)}
                <div>
                  <label htmlFor="shared-language" style={{ fontWeight: 700 }}>{giftFormText('storyLanguage', interfaceLanguage)}</label>
                  <select id="shared-language" value={brief.language ?? ''} disabled={busy} style={fieldStyle} onChange={event => {
                    const language = STORY_LANGUAGES.find(item => item.code === event.target.value)
                    if (!language) return
                    updateBrief(current => ({ ...current, language: language.code })); setAiConsent(false)
                    rememberStoryPreferences(language.code, brief.durationMinutes)
                  }}>
                    {!brief.language ? <option value="">Keep original language (saved brief)</option> : null}
                    {STORY_LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.label}</option>)}
                  </select>
                </div>
                <details>
                  <summary>{giftFormText('aboutStoryLanguage', interfaceLanguage)}</summary>
                  <p>{giftFormText('storyLanguageHelp', interfaceLanguage)}</p>
                </details>
                <RomanceOptions value={brief.romance} onChange={romance => { updateBrief(current => ({ ...current, romance })); setAiConsent(false) }} confirmed={romanceConfirmed} onConfirm={setRomanceConfirmed} disabled={busy} showConfirmation={false} language={interfaceLanguage} />
              </div>
              </fieldset>
              <fieldset hidden={creatorStep !== 1} disabled={busy || creatorStep !== 1} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              <div style={cardStyle}>
                <h2>2. {giftFormText('stepStory', interfaceLanguage)}</h2>
                {textField('setting', flow('giftStoryIdea'), '', 3000)}
                {textField('goal', flow('giftGoal'), '', 600)}
                <label htmlFor="puzzle-difficulty" style={{ fontWeight: 700 }}>{flow('storyDifficulty')}
                  <select id="puzzle-difficulty" value={brief.puzzleDifficulty ?? 'balanced'} disabled={busy} onChange={event => {
                    if (!['gentle', 'easy', 'balanced', 'challenging', 'expert'].includes(event.target.value)) return
                    updateBrief(current => ({ ...current, puzzleDifficulty: event.target.value as NonNullable<SharedStoryBrief['puzzleDifficulty']> }))
                    setAiConsent(false)
                  }} style={fieldStyle}>
                    <option value="gentle">{creation.difficultyGentle}</option>
                    <option value="easy">{creation.difficultyEasy}</option>
                    <option value="balanced">{creation.difficultyBalanced}</option>
                    <option value="challenging">{creation.difficultyChallenging}</option>
                    <option value="expert">{creation.difficultyExpert}</option>
                  </select>
                </label>
                <p>{flow('difficultyAttention')}</p>
                {textField('recipientHints', flow('giftPersonalTouches'), '', 1500, true)}
                {textField('narration', creation.style, '', 600, true)}
                <label style={{ fontWeight: 700 }}>{flow('duration')}
                  <select value={brief.durationMinutes} onChange={(event) => {
                    const duration = Number(event.target.value)
                    updateBrief(current => ({ ...current, durationMinutes: duration }))
                    setAiConsent(false)
                    rememberStoryPreferences(brief.language, duration)
                  }} style={fieldStyle} disabled={busy}>
                    {SHARED_STORY_DURATIONS.map((duration) => <option key={duration} value={duration}>{flow('aboutDuration')} {duration} {flow('minutes')}</option>)}
                  </select>
                </label>
                <fieldset aria-label={flow('interaction')} disabled={busy} style={{ display: 'grid', gap: '0.65rem', border: 0, padding: 0, marginTop: '0.5rem' }}>
                    <legend style={{ fontWeight: 700 }}>{flow('interaction')}</legend>
                    {[
                      ['classic', flow('preparedClueMode')],
                      ['free', flow('freeInput')],
                      ['suggested', flow('suggestedInput')]
                    ].map(([value, title]) => <label key={value} style={{ display: 'flex', gap: '0.75rem', alignItems: 'start', padding: '0.85rem', border: '1px solid #e4dcd4', borderRadius: 12, cursor: 'pointer' }}>
                      <input type="radio" name="story-interaction" value={value} checked={(brief.adventure ? brief.adventure.choiceMode ?? 'free' : 'classic') === value} onChange={() => {
                        updateBrief(current => {
                          const { adventure, ...rest } = current
                          return value === 'classic' ? rest : { ...rest, adventure: {
                            actionBudget: adventure?.actionBudget ?? 12, choiceMode: value === 'suggested' ? 'suggested' : 'free'
                          } }
                        })
                        setAiConsent(false)
                      }} />
                      <span>{title}</span>
                    </label>)}
                </fieldset>
                {brief.adventure?.choiceMode === 'suggested' ? <p>{creation.choicesHelp}</p> : null}
                {brief.adventure ? <>
                  <label htmlFor="adventure-budget">{flow('actionBudget')}
                    <input id="adventure-budget" type="number" min={1} max={1000} value={brief.adventure.actionBudget || ''} disabled={busy} onChange={event => { updateBrief(current => ({ ...current, adventure: { ...current.adventure!, actionBudget: Number(event.target.value) } })); setAiConsent(false) }} style={fieldStyle} />
                  </label>
                  <p>{flow('actionBudgetNote')}</p>
                </> : <p>{flow('preparedModeNote')}</p>}
              </div>
              </fieldset>
              <fieldset hidden={creatorStep !== 2} disabled={busy || creatorStep !== 2} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              <details style={cardStyle}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Personalize the gift story (optional)</summary>
                {!brief.gift ? <p>Choose an occasion above to add a personal opening and optional replies.</p> : <>
                  <label htmlFor="gift-dedication" style={{ display: 'block', marginTop: '1rem', fontWeight: 700 }}>A personal note from you
                    <textarea id="gift-dedication" value={brief.gift.dedication} maxLength={240} rows={3} style={fieldStyle} placeholder="I made this story with Muse so we can share an adventure and feel close, even from far away." disabled={busy} onChange={event => { updateBrief(current => ({ ...current, gift: { ...current.gift!, dedication: event.target.value } })); setAiConsent(false) }} />
                  </label>
                  <p>Shown on the cover before the story. Share why you made it or how you created it. Keep the answer and surprise private.</p>
                  <label style={{ display: 'block', padding: '0.75rem 0' }}><input type="checkbox" checked={brief.gift.allowReply} disabled={busy} onChange={event => { updateBrief(current => ({ ...current, gift: { ...current.gift!, allowReply: event.target.checked } })); setAiConsent(false) }} /> Let them send a private thank-you after the reveal</label>
                </>}
                <GiftVoiceRecorder file={voiceFile} onChange={file => { setVoiceFile(file); setAiConsent(false) }} disabled={busy} onActiveChange={setVoiceRecording} beforeRecord={() => { narrator.stop(); interaction.stopRecording() }} />
              </details>
              <div style={cardStyle}>
                <h2>{creation.ending}</h2>
                <p>{creation.endingHelp}</p>
                <fieldset aria-label={creation.ending} disabled={busy} style={{ border: 0, padding: 0 }}>
                  {(['answer', 'choice', 'automatic'] as const).map(value => <label key={value} style={{ display: 'flex', gap: '0.75rem', padding: '0.85rem', border: '1px solid var(--line)', borderRadius: 12, marginBlock: '0.5rem' }}>
                    <input type="radio" name="ending-mode" value={value} checked={(brief.endingMode ?? 'answer') === value} onChange={() => {
                      updateBrief(current => ({ ...current, endingMode: value }))
                      setAiConsent(false)
                    }} />
                    <span><strong>{creation[value]}</strong><br />{creation[`${value}Help`]}</span>
                  </label>)}
                </fieldset>
                {(brief.endingMode ?? 'answer') === 'answer' ? <>
                <fieldset aria-label="Ending interaction" disabled={busy} style={{ display: 'grid', gap: '0.65rem', border: 0, padding: 0 }}>
                  <legend style={{ fontWeight: 700 }}>How should they finish?</legend>
                  {[
                    ['clue', 'Find and identify a clue', 'They tell the story what they discovered.'],
                    ['action', 'Describe an action', 'They describe what they would do; the app checks the words, not a physical action.'],
                    ['word', 'Say a word aloud', 'A spoken word can be dictated or typed.'],
                    ['phrase', 'Say a phrase aloud', 'A phrase can be dictated or typed.']
                  ].map(([value, title, description]) => <label key={value} style={{ display: 'flex', gap: '0.75rem', alignItems: 'start', padding: '0.85rem', border: '1px solid #e4dcd4', borderRadius: 12, cursor: 'pointer' }}>
                    <input type="radio" name="ending-interaction" value={value} checked={(brief.answerType ?? 'phrase') === value} onChange={() => {
                      const answerType = value as SharedStoryBrief['answerType']
                      updateBrief(current => ({ ...current, answerType }))
                      setAiConsent(false)
                    }} />
                    <span><strong>{title}</strong><br />{description}</span>
                  </label>)}
                </fieldset>
                {textField('solution', flow('giftSolution'), '', 200)}
                <p>{flow('finalAnswerNote')}</p>
                <section aria-labelledby="accepted-answers-heading" style={{ marginBlock: '1rem', padding: '1rem', border: '1px solid #e4dcd4', borderRadius: 12 }}>
                  <h3 id="accepted-answers-heading" style={{ marginTop: 0 }}>{flow('giftAlternatives')} {flow('optional')}</h3>
                  {assistanceField('alternativeAnswers', flow('giftAlternatives'), flow('alternativesHelp'), 3, 200)}
                </section>
                <p>{flow('alternativesRule')}</p>
                <details style={{ marginBlock: '1rem' }}>
                  <summary>{creation.helpHints}</summary>
                  {assistanceField('assistanceHints', flow('hints'), flow('hintsHelp'), 3, 600)}
                </details>
                </> : brief.endingMode === 'choice' ? <label style={{ display: 'block', marginBlock: '1rem' }}>{creation.endingChoices}
                  <textarea id="ending-choices" value={(brief.endingChoices ?? []).join('\n')} rows={5} maxLength={804} required style={fieldStyle} onChange={event => {
                    updateBrief(current => ({ ...current, endingChoices: event.target.value.split('\n') }))
                    setAiConsent(false)
                  }} />
                  <span>{creation.endingChoicesHelp}</span>
                </label> : null}
                {brief.endingMode !== 'automatic' ? <>
                  {textField('answerInstruction', creation.endingPrompt, '', 500, true)}
                  <p>{creation.endingPromptHelp}</p>
                </> : null}
              </div>
              <div style={cardStyle}>
                <h2>{flow('finalReveal')}</h2>
                {(brief.endingMode ?? 'answer') === 'answer' ? <>
                <label style={{ fontWeight: 700 }}>{flow('unlockQuestion')}
                  <select aria-label={flow('unlockQuestion')} value={brief.unlockPolicy ?? 'solve'} disabled={busy} onChange={event => {
                    updateBrief(current => ({ ...current, unlockPolicy: event.target.value === 'allow-skip' ? 'allow-skip' : 'solve' }))
                    setAiConsent(false)
                  }} style={fieldStyle}>
                    <option value="solve">{flow('solveToUnlock')}</option>
                    <option value="allow-skip">{flow('allowSkip')}</option>
                  </select>
                </label>
                {brief.unlockPolicy === 'allow-skip' ? <p>{flow('skipNote')}</p> : null}
                </> : null}
                {textField('message', flow('giftMessage'), '', 2000, Boolean(mediaFile))}
                <label style={{ fontWeight: 700 }}>{flow('photoVideo')} {flow('optional')}
                  <input type="file" accept={SHARED_MEDIA_ACCEPT} disabled={busy} onChange={event => { chooseFile(event.target.files?.[0] ?? null); setAiConsent(false); event.target.value = '' }} style={fieldStyle} />
                </label>
                {mediaFile ? <p role="status">{mediaFile.name} ({formatMediaSize(mediaFile.size)}). <button type="button" disabled={busy} onClick={() => chooseFile(null)} style={{ ...buttonStyle, fontSize: '0.85rem' }}>{flow('removeFile')}</button></p> : null}
                <p>{flow('mediaLimits').replace('{photoSize}', formatMediaSize(SHARED_MEDIA_PHOTO_MAX_BYTES)).replace('{videoSize}', formatMediaSize(SHARED_MEDIA_VIDEO_MAX_BYTES))}</p>
              </div>
              <details style={{ marginBottom: '1rem' }}>
                <summary>{flow('privacyLimits')}</summary>
                <p>{flow('giftPrivacy')}</p>
                <p>{flow('giftBackupNote')}</p>
                <p>{flow('giftRateLimitNote').replace('{attempts}', String(SHARED_MEDIA_ATTEMPTS_PER_STORY))}</p>
              </details>
              {brief.romance ? <label style={{ display: 'block', padding: '1rem 0', lineHeight: 1.7 }}>
                {!permissions.managed ? <><input type="checkbox" checked={romanceConfirmed} disabled={busy} onChange={event => setRomanceConfirmed(event.target.checked)} /> {romanceCopy(interfaceLanguage).creatorConfirmation}</> : null}
              </label> : null}
              <ExplicitConsent checked={aiConsent} onChange={setAiConsent}>
                {flow('giftConsent')}
              </ExplicitConsent>
              <button disabled={busy || voiceRecording || Boolean(pendingDraft) || draftUnreadable} style={{ ...primaryStyle, width: '100%' }}>{busy ? upload.phase === 'uploading' ? `Uploading… ${upload.progress}%` : flow('preparingGift') : flow('prepareGift')}</button>
              </fieldset>
              <div style={{ display: 'flex', gap: 12, margin: '1rem 0' }}>
                {creatorStep > 0 ? <button type="button" disabled={busy || voiceRecording} onClick={() => { setCreatorStep(step => step - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={buttonStyle}>{flow('back')}</button> : null}
                {creatorStep < 2 ? <button type="button" disabled={busy || Boolean(pendingDraft) || draftUnreadable} onClick={nextCreatorStep} style={{ ...primaryStyle, flex: 1 }}>{flow('continue')}</button> : null}
              </div>
            </form>
          </section>
        )}
      </div>
    </main>
  )
}

import Head from 'next/head'
import Link from 'next/link'
import SiteNavigation from '../components/SiteNavigation'
import PageIllustration from '../components/PageIllustration'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { SHARED_STORY_DURATIONS, type SharedStoryBrief, type SharedStoryPlayer } from '../lib/sharedStory'
import { latestCreatorStory, loadStoryLibrary, removeLibraryEntry, saveLibraryCreatorStory, type CreatorStory } from '../lib/storyLibrary'
import { useStoryInteraction } from '../lib/useStoryInteraction'
import MicrophoneCheck from '../components/MicrophoneCheck'
import HoldToSpeakButton from '../components/HoldToSpeakButton'
import { recipientShareDetails, sharedStoryPreviewText } from '../lib/sharedStorySharing'
import { useNarration } from '../lib/useNarration'
import NarrationControls, { NarrationButton } from '../components/NarrationControls'
import SharedStoryReveal, { type RevealMedia } from '../components/SharedStoryReveal'
import ExplicitConsent from '../components/ExplicitConsent'
import GiftVoiceRecorder from '../components/GiftVoiceRecorder'
import StoryKeepsake from '../components/StoryKeepsake'
import PreSendCheck from '../components/PreSendCheck'
import GiftCard from '../components/GiftCard'
import GiftProgress from '../components/GiftProgress'
import type { SharedStoryProgress } from '../lib/sharedStoryProgress'
import StudioNarration, { type StudioSceneStatus } from '../components/StudioNarration'
import RomanceOptions from '../components/RomanceOptions'
import { romanceCopy, requireRomanceConfirmation, type StoryRomance } from '../lib/storyRomance'
import { STORY_LANGUAGES, storyLanguage, recipientCopy } from '../lib/storyLanguage'
import { GIFT_OCCASIONS, loadGiftDraft, removeGiftDraft, saveGiftDraft, type GiftDraft, type GiftOccasion } from '../lib/storyGift'
import { hasExplicitConsent, MUSE_AI_CONSENT_VERSION } from '../lib/legalContact'
import {
  formatMediaSize, parseMediaDeclaration, validateVoiceBytes, SHARED_MEDIA_ACCEPT, SHARED_MEDIA_ATTEMPTS_PER_STORY, SHARED_MEDIA_PHOTO_MAX_BYTES, SHARED_MEDIA_VIDEO_MAX_BYTES,
  type SharedMediaKind, type SharedMediaSummary
} from '../lib/sharedStoryMedia'

type PlayerResponse = { player: SharedStoryPlayer; sessionToken: string }
type RomanceNotice = { romance: StoryRomance; language?: SharedStoryBrief['language'] }
type OpenResponse = PlayerResponse | { romanceNotice: RomanceNotice }
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
const blankBrief: SharedStoryBrief = { creatorName: '', recipientName: '', narration: DEFAULT_NARRATION, setting: '', recipientHints: '', goal: '', solution: '', message: '', durationMinutes: 5, language: 'en-US', assistanceHints: [], alternativeAnswers: [] }
const idleUpload: UploadState = { phase: 'idle', progress: 0 }
const mediaLabel = (kind: SharedMediaKind) => kind === 'video' ? 'video' : 'photo'
type AssistanceField = 'assistanceHints' | 'alternativeAnswers'
const assistanceLines = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)

async function request<T>(body: Record<string, unknown>, creatorCode = '', signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/shared-story', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(creatorCode ? { 'x-muse-creator-code': creatorCode } : {}) }, body: JSON.stringify(body), signal
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Could not complete the story request.')
  return data as T
}

async function requestStudioAudio(body: Record<string, unknown>, signal: AbortSignal, creatorCode = ''): Promise<Blob> {
  const response = await fetch('/api/shared-story', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(creatorCode ? { 'x-muse-creator-code': creatorCode } : {}) },
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
async function requestMedia(body: Record<string, unknown>, creatorCode = ''): Promise<{ url: string; blob: boolean }> {
  const response = await fetch('/api/shared-story', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(creatorCode ? { 'x-muse-creator-code': creatorCode } : {}) }, body: JSON.stringify(body)
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

// The creator code is attached only to Muse's own upload route, never to storage hosts.
function putFile(target: UploadTarget, file: File, creatorCode: string, onProgress: (percent: number) => void): Promise<void> {
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
    if (sameOrigin && creatorCode) xhr.setRequestHeader('x-muse-creator-code', creatorCode)
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
  const [brief, setBrief] = useState<SharedStoryBrief>(blankBrief)
  const [assistanceHintsText, setAssistanceHintsText] = useState('')
  const [alternativeAnswersText, setAlternativeAnswersText] = useState('')
  const [creator, setCreator] = useState<CreatorStory | null>(null)
  const [player, setPlayer] = useState<SharedStoryPlayer | null>(null)
  const [playToken, setPlayToken] = useState('')
  const [sessionToken, setSessionToken] = useState('')
  const [guess, setGuess] = useState('')
  const [actionText, setActionText] = useState('')
  const [aiConsent, setAiConsent] = useState(false)
  const [romanceConfirmed, setRomanceConfirmed] = useState(false)
  const [romanceNotice, setRomanceNotice] = useState<RomanceNotice | null>(null)
  const [romanceAccepted, setRomanceAccepted] = useState(false)
  const [recipientConfirmation, setRecipientConfirmation] = useState(false)
  const [romanceDeclined, setRomanceDeclined] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [origin, setOrigin] = useState('')
  const [tunnelAddress, setTunnelAddress] = useState('')
  const [publicOrigin, setPublicOrigin] = useState('')
  const [canDeviceShare, setCanDeviceShare] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [creatorCodeInput, setCreatorCodeInput] = useState('')
  const [creatorCode, setCreatorCode] = useState('')
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
  const [replyText, setReplyText] = useState('')
  const [replySent, setReplySent] = useState(false)
  const [giftOpened, setGiftOpened] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<GiftDraft | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const [draftStatus, setDraftStatus] = useState('')
  const [draftUnreadable, setDraftUnreadable] = useState(false)
  const [creatorStep, setCreatorStep] = useState(0)
  const [sendReady, setSendReady] = useState('')
  const creatorForm = useRef<HTMLFormElement>(null)
  const storedVoiceAudio = useRef<HTMLAudioElement>(null)
  const studioAudio = useRef<HTMLAudioElement>(null)
  const [studioScene, setStudioScene] = useState(0)
  const objectUrls = useRef<string[]>([])
  const lastMediaRefresh = useRef(0)
  const creatorLocked = process.env.NEXT_PUBLIC_MUSE_CREATOR_LOCKED === 'true'
  const narrator = useNarration(player || creator?.content || {}, undefined, {
    progress: player?.adventure ? player.adventure.actionsUsed / 12
      : player ? player.sceneIndex / Math.max(1, player.sceneCount - 1) : 0,
    ending: player ? player.solved || player.skipped : undefined,
    sceneKey: player ? `${playToken}:${player.adventure?.revision ?? player.sceneIndex}:${player.solved}:${player.skipped}`
      : creator?.ownerToken || 'new'
  }, { browserOnly: true })
  const interaction = useStoryInteraction(() => { studioAudio.current?.pause(); narrator.stop() }, player?.language || creator?.brief.language || brief.language || 'en-US')
  const beforeStudio = () => { narrator.stop(); interaction.stopRecording(); storedVoiceAudio.current?.pause() }
  const markSendReady = useCallback((ready: boolean) => setSendReady(ready ? creator?.ownerToken || '' : ''), [creator?.ownerToken])
  const confirmShareReady = () => {
    if (creator && sendReady === creator.ownerToken && Date.parse(creator.expiresAt) > Date.now() && !mediaFile && !voiceFile && !voiceUploading && upload.phase !== 'uploading') return true
    setError('Review the pre-send checks and finish uploads before sharing an unexpired story.')
    return false
  }
  const recipientText = recipientCopy(player?.language)
  const recipientLanguage = storyLanguage(player?.language || romanceNotice?.language)
  const romanceText = romanceCopy(romanceNotice?.language || player?.language)
  const recipientRequest = <T,>(body: Record<string, unknown>) => request<T>({ ...body, ...(romanceAccepted ? { romanceConfirmed: true } : {}) })
  useEffect(() => { setRomanceConfirmed(false) }, [brief])
  useEffect(() => {
    interaction.cancelRecording()
  }, [player?.language, brief.language])

  useEffect(() => {
    let active = true
    setOrigin(window.location.origin)
    setCanDeviceShare(typeof navigator.share === 'function')
    const initialize = async () => {
      try {
        if (new URLSearchParams(window.location.search).has('share')) {
          throw new Error('This old prototype link contains exposed story data and is no longer supported. Ask the creator for a new private story link.')
        }
        const fragment = new URLSearchParams(window.location.hash.slice(1))
        const recipientToken = fragment.get('play')
        if (recipientToken) {
          setPlayToken(recipientToken)
          let savedSession: string | null = null
          try {
            savedSession = window.localStorage.getItem(`muse-shared-player:${recipientToken}`)
          } catch {
            setNotice('This browser cannot save progress. You can play now, but reopening the link will start a new session.')
          }
          const result = await request<OpenResponse>({ action: 'open', token: recipientToken, ...(savedSession ? { sessionToken: savedSession } : {}) })
          if (!active) return
          if ('romanceNotice' in result) {
            setRomanceNotice(result.romanceNotice)
            setRomanceAccepted(false)
            setRecipientConfirmation(false)
            setRomanceDeclined(false)
            setPlayer(null)
            return
          }
          setPlayer(result.player)
          setSessionToken(result.sessionToken)
          try {
            window.localStorage.setItem(`muse-shared-player:${recipientToken}`, result.sessionToken)
          } catch {
            setNotice('This browser cannot save progress. You can play now, but reopening the link will start a new session.')
          }
          return
        }
        if (creatorLocked && !creatorCode) return
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
          const { media, mediaRequired: _required, voice, replies: savedReplies, ...result } = await request<Omit<CreatorStory, 'ownerToken' | 'playToken'> & MediaState & GiftState>({ action: 'manage', token: ownerToken }, creatorCode)
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
          try { setPendingDraft(loadGiftDraft()) } catch (error) { setDraftUnreadable(true); setDraftStatus(error instanceof Error ? error.message : 'Could not read your draft.') }
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
  }, [creatorCode, creatorLocked])

  const acceptRomance = async () => {
    if (!romanceNotice || !recipientConfirmation || busy) return
    setBusy(true); setError('')
    try {
      let savedSession: string | null = null
      try { savedSession = window.localStorage.getItem(`muse-shared-player:${playToken}`) } catch {
        setNotice('This browser cannot save progress. Reopening will require a new opt-in and may start a new session.')
      }
      const result = await request<PlayerResponse>({
        action: 'open', token: playToken, romanceConfirmed: true, ...(savedSession ? { sessionToken: savedSession } : {})
      })
      setRomanceAccepted(true)
      setPlayer(result.player)
      setSessionToken(result.sessionToken)
      try { window.localStorage.setItem(`muse-shared-player:${playToken}`, result.sessionToken) } catch {
        setNotice('This browser cannot save progress. Keep this page open to continue.')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not open this story.')
    } finally { setBusy(false) }
  }

  useEffect(() => {
    if (!draftReady || pendingDraft || draftUnreadable || loading || creator || playToken || busy) return
    if (![brief.creatorName, brief.recipientName, brief.setting, brief.solution, brief.message, brief.recipientHints, brief.gift?.dedication].some(value => value?.trim())) return
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

  const chooseOccasion = (occasion?: GiftOccasion) => {
    const chosen = GIFT_OCCASIONS.find(item => item.id === occasion)
    setBrief(current => {
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
    setSendReady('')
    setOwnerMedia(null)
    setOwnerPreview(null)
    setMediaFile(null)
    setVoiceFile(null)
    setOwnerVoice(null)
    setVoiceUrl('')
    setVoiceError('')
    setReplies([])
    try { setPendingDraft(loadGiftDraft()) } catch (error) { setDraftUnreadable(true); setDraftStatus(error instanceof Error ? error.message : 'Could not read your draft.') }
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
      const started = await request<{ uploadId: string; upload: UploadTarget }>({ action: 'media-start', token: story.ownerToken, media: { mime: declaration.mime, size: declaration.size } }, creatorCode)
      uploadId = started.uploadId
      await putFile(started.upload, file, creatorCode, progress => setUpload({ phase: 'uploading', progress }))
      const finished = await request<MediaState>({ action: 'media-finish', token: story.ownerToken, uploadId }, creatorCode)
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
      if (uploadId) void request({ action: 'media-cancel', token: story.ownerToken, uploadId }, creatorCode).catch(() => undefined)
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
      const result = await request<MediaState>({ action: 'media-delete', token: creator.ownerToken }, creatorCode)
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
      const result = await requestMedia({ action: 'media-preview', token: creator.ownerToken }, creatorCode)
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
        const started = await request<{ uploadId: string; upload: UploadTarget }>({ action: 'voice-start', token: story.ownerToken, voice: { mime: 'audio/wav', size: file.size } }, creatorCode)
        uploadId = started.uploadId
        await putFile(started.upload, file, creatorCode, () => undefined)
        const finished = await request<GiftState>({ action: 'voice-finish', token: story.ownerToken, uploadId }, creatorCode)
        uploadId = ''
        setOwnerVoice(finished.voice ?? null)
        setVoiceFile(null)
        setVoiceUrl('')
        setNotice('Your voice message is attached. It unlocks with the final reveal.')
      } catch (error) {
        setVoiceError(`${error instanceof Error ? error.message : 'Could not upload the recording.'} Your story is saved. Retry without generating again.`)
        if (uploadId) {
          try { await request({ action: 'voice-cancel', token: story.ownerToken, uploadId }, creatorCode) }
          catch { setVoiceError(current => `${current} The unfinished upload could not be cancelled; it will expire automatically.`) }
        }
      } finally { setVoiceUploading(false) }
    }

    const loadVoice = async (owner = false) => {
      setVoiceError('')
      try {
        const result = await requestMedia(owner && creator ? { action: 'voice-preview', token: creator.ownerToken } : { action: 'voice', token: playToken, sessionToken, ...(romanceAccepted ? { romanceConfirmed: true } : {}) }, owner ? creatorCode : '')
        setVoiceUrl(mediaUrl(result))
      } catch (error) { setVoiceError(error instanceof Error ? error.message : 'Could not load the voice message. Try again.') }
    }

    const removeVoice = async () => {
      if (!creator || !window.confirm('Remove your stored voice message? The written story and other media will remain.')) return
      setBusy(true)
      try {
        await request({ action: 'voice-delete', token: creator.ownerToken }, creatorCode)
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
        const result = await request<GiftState>({ action: 'manage', token: creator.ownerToken }, creatorCode)
        setReplies(result.replies ?? [])
      } catch (error) { setError(error instanceof Error ? error.message : 'Could not load replies.') }
      finally { setBusy(false) }
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
      const assistanceHints = assistanceLines(assistanceHintsText)
      const alternativeAnswers = assistanceLines(alternativeAnswersText)
      if (assistanceHints.length > 3 || assistanceHints.some(hint => hint.length > 600)) {
        throw new Error('Enter up to 3 assistance hints, with at most 600 characters each.')
      }
      if (alternativeAnswers.length > 5 || alternativeAnswers.some(answer => answer.length > 200)) {
        throw new Error('Enter up to 5 approved alternative answers, with at most 200 characters each.')
      }
      if (brief.adventure && !(Number.isInteger(brief.adventure.actionBudget) && brief.adventure.actionBudget >= 1 && brief.adventure.actionBudget <= 1000)) {
        throw new Error('Under Advanced options, approve an adventure AI action budget from 1 to 1000.')
      }
      const preparedBrief = { ...brief, narration: brief.narration.trim() || DEFAULT_NARRATION, assistanceHints, alternativeAnswers }
      try { saveGiftDraft({ version: 1, brief: preparedBrief, assistanceHintsText, alternativeAnswersText, savedAt: new Date().toISOString() }) }
      catch { setDraftStatus('Draft could not be saved on this device. Keep the page open if preparation fails.') }
      const { media: _media, mediaRequired: _required, voice: _voice, replies: _replies, ...story } = await request<CreatorStory & MediaState & GiftState>({
        action: 'create', brief: preparedBrief, consentVersion: MUSE_AI_CONSENT_VERSION,
        ...(brief.romance ? { romanceConfirmed } : {}),
        ...(voiceFile ? { finalVoice: { mime: 'audio/wav', size: voiceFile.size } } : {}),
        ...(declaration ? { finalMedia: { mime: declaration.mime, size: declaration.size } } : {})
      }, creatorCode)
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

  const act = async (action: 'guess' | 'next' | 'hint' | 'skip') => {
    if (action === 'skip' && !window.confirm(recipientText.skipConfirm)) return
    setBusy(true)
    setError('')
    interaction.cancelRecording()
    narrator.stop()
    try {
      const result = await recipientRequest<PlayerResponse>({ action, token: playToken, sessionToken, ...(action === 'guess' ? { guess } : {}), ...(action === 'skip' ? { confirmSkip: true } : {}) })
      setPlayer(result.player)
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
            ...(saved ? JSON.parse(saved) : { requestId: crypto.randomUUID(), revision: player.adventure.revision, text: selectedChoice ?? actionText.trim() }),
            consentVersion: MUSE_AI_CONSENT_VERSION
          }
          window.localStorage.setItem(storageKey, JSON.stringify(attempt))
          if (saved) setActionText(attempt.text)
          submission = { action: 'adventure', token: playToken, sessionToken, ...attempt, consentVersion: MUSE_AI_CONSENT_VERSION }
        }
        const response = await fetch('/api/shared-story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...submission, ...(romanceAccepted ? { romanceConfirmed: true } : {}) }) })
        const data = await response.json()
        if (data.player) setPlayer(data.player)
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

  const copy = async (value: string, recipient = false) => {
    if (recipient && !confirmShareReady()) return
    try {
      if (!navigator.clipboard) throw new Error('Clipboard is unavailable. Select and copy the link below.')
      await navigator.clipboard.writeText(value)
      setNotice('Link copied.')
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not copy the link. Select and copy it manually.')
    }
  }

  const creatorAction = async (action: 'share' | 'delete') => {
    if (!creator) return
    if (action === 'share' && !confirmShareReady()) return
    setBusy(true)
    setError('')
    narrator.stop()
    try {
      if (action === 'share') {
        const result = await request<{ playToken: string }>({ action, token: creator.ownerToken }, creatorCode)
        const saved = storeCreator({ ...creator, playToken: result.playToken })
        if (saved) setNotice('New recipient link created. Any previous recipient link no longer works.')
      } else {
        await request({ action, token: creator.ownerToken }, creatorCode)
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
      setError(error instanceof Error ? error.message : 'Could not update the story.')
    } finally {
      setBusy(false)
    }
  }

  const textField = (key: Exclude<keyof SharedStoryBrief, 'durationMinutes' | 'adventure' | 'unlockPolicy' | 'gift' | 'language' | 'romance' | AssistanceField>, label: string, placeholder: string, max: number, optional = false) => (
    <div style={{ marginBottom: '1.2rem' }}>
      <label htmlFor={`brief-${key}`} style={{ fontWeight: 700 }}>{label}{optional ? ' (optional)' : ''}</label>
      {key === 'creatorName' || key === 'recipientName' ? <input id={`brief-${key}`} type="text" required={!optional} value={brief[key]} onChange={event => { setBrief({ ...brief, [key]: event.target.value }); setAiConsent(false) }} maxLength={max} placeholder={placeholder} style={fieldStyle} disabled={busy} /> :
        <textarea id={`brief-${key}`} required={!optional} value={brief[key]} onChange={(event) => { setBrief({ ...brief, [key]: event.target.value }); setAiConsent(false) }} rows={key === 'setting' || key === 'message' ? 4 : 2} maxLength={max} placeholder={placeholder} style={fieldStyle} disabled={busy} />}
      <HoldToSpeakButton label={`Hold to dictate ${label}`} releaseLabel={`Release to stop ${label}`} recording={interaction.recordingTarget === key} disabled={busy} onStart={() => interaction.dictate(key, (value) => { setBrief((current) => ({ ...current, [key]: value.slice(0, max) })); setAiConsent(false) }, key === 'creatorName' || key === 'recipientName')} onStop={() => interaction.stopRecording(key)} style={{ ...buttonStyle, marginTop: '0.5rem', fontSize: '0.85rem' }} />
      {interaction.recordingTarget === key ? <p role="status">{interaction.ready ? 'Listening. Review your text before sending.' : 'Starting microphone...'}</p> : null}
    </div>
  )

  const assistanceField = (key: AssistanceField, label: string, description: string, maxEntries: number, maxEntryLength: number) => {
    const value = key === 'assistanceHints' ? assistanceHintsText : alternativeAnswersText
    const update = key === 'assistanceHints' ? setAssistanceHintsText : setAlternativeAnswersText
    return (
      <div style={{ marginBottom: '1.2rem' }}>
        <label htmlFor={`brief-${key}`} style={{ fontWeight: 700 }}>{label} (optional)</label>
        <textarea id={`brief-${key}`} value={value} onChange={event => { update(event.target.value); setAiConsent(false) }} rows={maxEntries} maxLength={maxEntries * (maxEntryLength + 2)} placeholder="One entry per line" aria-describedby={`brief-${key}-help`} style={fieldStyle} disabled={busy} />
        <p id={`brief-${key}-help`}>{description} Max {maxEntries} lines, {maxEntryLength} characters each.</p>
      </div>
    )
  }

  const audioButton = (text: string) => <NarrationButton narrator={narrator} text={text} label="Use device voice (quality varies)" beforeSpeak={interaction.stopRecording} />

  const shareDetails = origin && creator?.playToken ? recipientShareDetails(publicOrigin || origin, creator.playToken) : null
  const playerLink = shareDetails?.url || ''
  const managementLink = creator ? `${origin}/shared#manage=${creator.ownerToken}` : ''
  const selectedOccasion = GIFT_OCCASIONS.find(item => item.id === brief.gift?.occasion)
  const showGiftCover = Boolean(player?.gift && !giftOpened)
  const adventureCanSubmit = Boolean(player?.adventure &&
    (player.adventure.pending || (player.adventure.actionsRemaining > 0 && player.adventure.budgetRemaining > 0)))

  const shareOnDevice = async () => {
    if (!shareDetails || shareDetails.localOnly || sharing) return
    if (!confirmShareReady()) return
    setSharing(true)
    setError('')
    narrator.stop()
    try {
      await navigator.share({ title: 'A Muse story for you', text: shareDetails.text, url: shareDetails.url })
      setNotice('Link handed to your device sharing app. Delivery is handled by that app.')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setNotice('Sharing cancelled. Your story and link are unchanged.')
      } else {
        setError('Could not open device sharing. Copy the recipient link or use WhatsApp instead.')
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <main className="atelier-page">
      <Head>
        <title>{playToken ? 'Muse - A gift story for you' : creator ? 'Muse - Manage your gift story' : 'Muse - Create a gift story'}</title>
        <meta name="description" content="Give Muse your idea and personal clues. Create a mystery for someone else to solve." />
        <meta name="referrer" content="no-referrer" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <SiteNavigation pathname="/shared" recipient={Boolean(playToken)} onCreateGift={creator ? () => startNewStory() : undefined} />
      {!playToken && !creator ? <PageIllustration pathname="/shared" /> : null}
      <div style={{ maxWidth: 850, margin: '0 auto', padding: 'clamp(1rem, 4vw, 1.5rem)' }}>
        {error || interaction.error || narrator.error ? <p role="alert" style={{ ...cardStyle, color: '#a14329' }}>{error || interaction.error || narrator.error}</p> : null}
        {notice ? <p role="status" style={cardStyle}>{notice}</p> : null}
        {creatorLocked && !playToken ? <section style={cardStyle} aria-label="Private creator access">
          <h2>Private creator access</h2>
          <p>Code required to create or manage stories; never saved. Keep it and your management link private.</p>
          <label>Creator access code<input type="password" autoComplete="off" value={creatorCodeInput} onChange={event => setCreatorCodeInput(event.target.value)} style={fieldStyle} /></label>
          <button style={{ ...buttonStyle, marginTop: '0.75rem' }} onClick={() => {
            if (creatorCodeInput.length < 16 || creatorCodeInput.length > 512) { setError('Enter a creator access code of 16 to 512 characters.'); return }
            setError('')
            setCreatorCode(creatorCodeInput)
            setCreatorCodeInput('')
          }}>Use creator access code</button>
          {creatorCode ? <p role="status">Code entered; checked on your next request.</p> : null}
        </section> : null}
        {!playToken && !showGiftCover && !(romanceNotice && !romanceAccepted) ? <details style={{ marginBottom: '1rem' }}>
          <summary>Audio and microphone settings</summary>
          {playToken ? <p lang={recipientLanguage.code} dir={recipientLanguage.dir}>{recipientText.settingsDisclosure}</p> : null}
          <NarrationControls narrator={narrator} beforeSpeak={interaction.stopRecording} />
          <section aria-label="Voice input settings">
          <p>Dictation fills editable text, not a saved recording. It may use your browser&apos;s online speech service.</p>
          <p>Voice input follows the story language.</p>
          <MicrophoneCheck stopSignal={voiceRecording ? 'gift-voice-recording' : interaction.recordingTarget} beforeTest={() => { interaction.stopRecording(); narrator.stop() }} />
          </section>
        </details> : null}
        {loading ? <p role="status">Opening your private story...</p> : playToken && romanceNotice && !romanceAccepted ? (
          <section lang={recipientLanguage.code} dir={recipientLanguage.dir} aria-label="Romance content notice" style={cardStyle}>
            <h1>{romanceText.title(romanceNotice.romance)}</h1>
            {romanceDeclined ? <>
              <p role="status">{romanceText.declined}</p>
              <Link href="/" style={{ color: 'inherit' }}>Muse</Link>
            </> : <>
              <p style={{ lineHeight: 1.8 }}>{romanceText.notice(romanceNotice.romance)}</p>
              <label style={{ display: 'block', lineHeight: 1.8, padding: '1rem 0' }}>
                <input type="checkbox" checked={recipientConfirmation} disabled={busy} onChange={event => setRecipientConfirmation(event.target.checked)} /> {romanceText.confirm}
              </label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button type="button" disabled={busy || !recipientConfirmation} onClick={() => void acceptRomance()} style={primaryStyle}>{romanceText.open}</button>
                <button type="button" disabled={busy} onClick={() => { narrator.stop(); interaction.stopRecording(); setRecipientConfirmation(false); setRomanceDeclined(true) }} style={buttonStyle}>{romanceText.decline}</button>
              </div>
            </>}
          </section>
        ) : creatorLocked && !playToken && !creatorCode ? <p>Recipients need only their story link.</p> : playToken ? player ? (
          <section className="atelier-reading" lang={recipientLanguage.code} dir={recipientLanguage.dir}>
            <details lang="en" dir="ltr" style={{ marginBottom: '1rem' }}>
              <summary>About this private story</summary>
              <p>The sender can see anonymous playthrough counts, the furthest prepared scene reached, and whether the mystery was solved or revealed without solving. This does not identify you. <Link href="/privacy">Privacy</Link></p>
              <p>Voice input follows this story&apos;s language and may use your browser&apos;s online speech service.</p>
            </details>
            {showGiftCover ? <article aria-label="Your gift story" style={{ ...cardStyle, textAlign: 'center', padding: 'clamp(1.5rem, 6vw, 3.5rem) 1rem' }}>
              <p className="atelier-eyebrow">{recipientText.madeForYou}</p>
              <h1 className="atelier-title" style={{ fontSize: 'clamp(2rem, 9vw, 3.5rem)', overflowWrap: 'anywhere' }}>{recipientText.forYou(player.recipientName)}</h1>
              <p>{recipientText.from(player.creatorName)}</p>
              {player.gift?.dedication ? <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, maxWidth: 440, margin: '1.5rem auto', overflowWrap: 'anywhere' }}>{player.gift.dedication}</p> : null}
              <p>{recipientText.duration(player.durationMinutes)}</p>
              <button type="button" onClick={() => setGiftOpened(true)} style={{ ...primaryStyle, marginTop: '1rem', minHeight: 48 }}>{recipientText.openStory}</button>
              <p style={{ fontSize: '0.9rem' }}>{recipientText.noAccount}</p>
            </article> : <>
            <p>{recipientText.storyFrom(player.creatorName, player.recipientName)}</p>
            <h1 className="atelier-title" style={{ fontSize: 'clamp(2rem, 7vw, 3rem)', overflowWrap: 'anywhere' }}>{player.title}</h1>
            <p style={{ lineHeight: 1.7 }}>{player.description}</p>
            <p>{recipientText.duration(player.durationMinutes)}</p>
            {player.solved || player.skipped ? (
              <article style={cardStyle}>
                <p><strong>{player.skipped ? recipientText.skipped : recipientText.solved}</strong></p>
                <SharedStoryReveal message={player.message} media={player.media ? revealMedia ?? { kind: player.media.kind, state: 'loading' } : null}
                  narrator={narrator} beforeSpeak={interaction.stopRecording} onMediaError={refreshRevealMedia}
                  onRetryMedia={player.media ? () => void loadRevealMedia(player.media!.kind) : undefined} language={player.language} />
                {player.voice ? <section aria-label="A voice message for you">
                  <h3>{recipientText.voiceTitle}</h3>
                  {voiceUrl ? <audio ref={storedVoiceAudio} controls preload="metadata" src={voiceUrl} onPlay={() => { studioAudio.current?.pause(); narrator.stop(); interaction.stopRecording() }} onError={() => { setVoiceUrl(''); setVoiceError(recipientText.voiceError) }} style={{ maxWidth: '100%' }} aria-label={recipientText.voiceTitle} /> : null}
                  {voiceError ? <p role="alert">{voiceError}</p> : null}
                  <button type="button" style={buttonStyle} onClick={() => void loadVoice()}>{voiceUrl ? recipientText.reloadVoice : recipientText.loadVoice}</button>
                </section> : null}
                {player.adventure?.turn ? <><h3>{recipientText.yourJourney}</h3><p>{player.adventure.turn.narration}</p><p>{player.adventure.turn.state.progress}</p></> : null}
                <details style={{ marginTop: '1rem' }}>
                  <summary>Keep this story</summary>
                  {player.adventure ? <p>Your keepsake contains the available scenes and latest adventure turn, not a transcript of every live action.</p> : null}
                  <StoryKeepsake story={{ title: player.title, creatorName: player.creatorName, recipientName: player.recipientName, dedication: player.gift?.dedication,
                    scenes: [...player.discoveries, player.scene, ...(player.adventure?.turn ? [{ title: 'Your adventure', body: player.adventure.turn.narration }] : [])].map(scene => ({ title: scene.title, body: scene.body })), message: player.message }} />
                </details>
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
                <h2>{player.adventure.turn ? recipientText.adventureContinues : player.scene.title}</h2>
                <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{player.adventure.turn?.narration || player.scene.body}</p>
                <details><summary>Device voice (optional, quality varies)</summary>
                  <p>Prepared cloud recordings do not cover live adventure turns. This option uses your phone&apos;s voice, not Google narration.</p>
                  <NarrationButton narrator={narrator} text={player.adventure.turn?.narration || `${player.scene.body} ${player.scene.clue}`} label={recipientText.playAdventure} beforeSpeak={interaction.stopRecording} />
                </details>
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
                  <div style={{ display: 'grid', gap: '0.75rem' }}>{player.adventure.choices?.map(choice => <button key={choice} disabled={busy || player.adventure?.pending} onClick={() => void adventureAction(false, choice)} style={{ ...buttonStyle, textAlign: 'start' }}>{choice}</button>)}</div>
                  {!player.adventure.choices?.length && !player.adventure.pending ? <p>{recipientText.refreshProgress}</p> : null}
                </section> : <form onSubmit={event => { event.preventDefault(); void adventureAction() }}>
                  <label htmlFor="adventure-action">{recipientText.yourAction}<textarea id="adventure-action" value={actionText} onFocus={() => interaction.cancelRecording()} onChange={event => { interaction.cancelRecording(); setActionText(event.target.value); setAiConsent(false) }} maxLength={800} rows={3} style={fieldStyle} disabled={busy} /></label>
                  <p>{recipientText.reviewGuess}</p>
                  <HoldToSpeakButton label={`Hold to ${recipientText.dictateAction.toLowerCase()}`} releaseLabel={`Release to stop ${recipientText.dictateAction.toLowerCase()}`} disabled={busy} recording={interaction.recordingTarget === 'adventure-action'} onStart={() => interaction.dictate('adventure-action', value => { setActionText(value.slice(0, 800)); setAiConsent(false) })} onStop={() => interaction.stopRecording('adventure-action')} style={buttonStyle} />
                  {interaction.recordingTarget === 'adventure-action' ? <p role="status">{interaction.ready ? recipientText.listening : recipientText.startingMicrophone}</p> : null}
                  <button disabled={busy || Boolean(player.adventure.pending) || !actionText.trim()} style={primaryStyle}>{recipientText.submitAction}</button>
                </form> : <p>{player.adventure.budgetRemaining <= 0 ? recipientText.noBudget : recipientText.noActions}</p>}
                {player.adventure.pending ? <p role="status">{recipientText.pendingAction}</p> : null}
              </article> : <article style={cardStyle}>
                  <p>{recipientText.scene(player.sceneIndex + 1, player.sceneCount)}</p>
                  <h2>{player.scene.title}</h2>
                    <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{player.scene.body}</p>
                    <p style={{ lineHeight: 1.7 }}><strong>{recipientText.clue}:</strong> {player.scene.clue}</p>
                  <StudioNarration key={`${playToken}:${sessionToken}:${player.sceneIndex}`} sceneIndex={player.sceneIndex} audioRef={studioAudio}
                    disabled={busy} stopSignal={narrator.busy || Boolean(interaction.recordingTarget)} beforeListen={beforeStudio}
                    load={(sceneIndex, signal) => requestStudioAudio({ action: 'studio-audio', token: playToken, sessionToken, sceneIndex, ...(romanceAccepted ? { romanceConfirmed: true } : {}) }, signal)} />
                  <details><summary>Device voice (optional, quality varies)</summary>
                    <NarrationButton narrator={narrator} text={`${player.scene.title}. ${player.scene.body} ${player.scene.clue}`} label={recipientText.playScene} beforeSpeak={interaction.stopRecording} />
                  </details>
                  {player.sceneIndex + 1 < player.sceneCount ? <>
                    <h3>{recipientText.next}</h3>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {(player.scene.choices || [recipientText.next]).map(choice => <button key={choice} disabled={busy} onClick={() => void act('next')} style={{ ...buttonStyle, textAlign: 'start' }}>{choice}</button>)}
                    </div>
                  </> : <p>{recipientText.tryAnswer}</p>}
                </article>}
                {player.discoveries.length > 0 ? (
                  <details style={cardStyle}>
                    <summary>{recipientText.earlier} ({player.discoveries.length})</summary>
                    {player.discoveries.map((scene, index) => (
                      <article key={index}>
                        <h3>{scene.title}</h3>
                        <p style={{ lineHeight: 1.8 }}>{scene.body}</p>
                        <p><strong>{recipientText.clue}:</strong> {scene.clue}</p>
                        {audioButton(`${scene.body} ${scene.clue}`)}
                      </article>
                    ))}
                  </details>
                ) : null}
                <form onSubmit={(event) => { event.preventDefault(); void act('guess') }} style={cardStyle}>
                  <label style={{ fontWeight: 700 }}>{recipientText.answer}<input value={guess} onFocus={() => interaction.cancelRecording()} onChange={(event) => { interaction.cancelRecording(); setGuess(event.target.value) }} maxLength={200} required style={fieldStyle} disabled={busy} /></label>
                  <p>{recipientText.guessHelp} {player.canSkip ? recipientText.skipHelp : recipientText.solveHelp}</p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button disabled={busy || !guess.trim()} style={primaryStyle}>{recipientText.tryAnswer}</button>
                    <HoldToSpeakButton label={`Hold to ${recipientText.dictateAnswer.toLowerCase()}`} releaseLabel={`Release to stop ${recipientText.dictateAnswer.toLowerCase()}`} disabled={busy} recording={interaction.recordingTarget === 'guess'} onStart={() => interaction.dictate('guess', (value) => setGuess(value.slice(0, 200)))} onStop={() => interaction.stopRecording('guess')} style={buttonStyle} />
                  </div>
                  <p>{recipientText.reviewGuess}</p>
                  {interaction.recordingTarget === 'guess' ? <p role="status">{interaction.ready ? recipientText.listening : recipientText.startingMicrophone}</p> : null}
                </form>
              </>
            )}
            {!player.solved && !player.skipped ? <details style={cardStyle}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{recipientText.needHelp}</summary>
              <p>{recipientText.pauseHelp}</p>
              <p>{recipientText.contactSender(player.creatorName)}</p>
              {player.canSkip ? <>
                <p>{recipientText.skipHelp}</p>
                <button disabled={busy} onClick={() => void act('skip')} style={buttonStyle}>{recipientText.skip}</button>
              </> : <p>{recipientText.solveHelp}</p>}
              {!player.hintsRemaining && !player.revealedHints.length ? <p>{recipientText.noHints}</p> : null}
            </details> : null}
            {(player.revealedHints.length > 0 || (!player.solved && !player.skipped && player.hintsRemaining > 0)) ? (
              <details style={cardStyle}>
                <summary>{recipientText.hintTitle}</summary>
                {player.revealedHints.length > 0 ? (
                  <ol>{player.revealedHints.map((hint, index) => <li key={index} style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{hint}</li>)}</ol>
                ) : <p>{recipientText.hintsNoCost}</p>}
                {!player.solved && !player.skipped && player.hintsRemaining > 0 ? (
                  <button disabled={busy} onClick={() => void act('hint')} style={buttonStyle}>{recipientText.showHint} ({recipientText.hintRemaining(player.hintsRemaining)})</button>
                ) : player.hintsRemaining === 0 ? <p>{recipientText.hintsExhausted}</p> : null}
              </details>
            ) : null}
            {player.feedback ? <p role="status">{player.feedback}</p> : null}
            <details style={{ marginTop: '1rem' }}>
              <summary>Audio settings</summary>
              <p>{recipientText.settingsDisclosure}</p>
              <NarrationControls narrator={narrator} beforeSpeak={interaction.cancelRecording} />
            </details>
            </>}
          </section>
        ) : <p>Could not open the story. Check the link or ask its creator for a new one.</p> : creator ? (
          <section>
            <p>Private creator preview</p>
            {creator.brief.romance ? <p>{romanceCopy().title(creator.brief.romance)}. Recipients see a content notice and choose whether to open before seeing any story text.</p> : null}
            <h1>{creator.content.title}</h1>
            <p>{creator.content.description}</p>
            {creator.content.scenes.map((scene, index) => (
              <article key={index} style={cardStyle} aria-label={`Story scene ${index + 1}`}>
                <h2>{scene.title}</h2>
                <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{scene.body}</p>
                <p><strong>Clue:</strong> {scene.clue}</p>
                <details><summary>Listen to this scene</summary>{audioButton(`${scene.body} ${scene.clue}`)}</details>
              </article>
            ))}
            <details style={{ marginTop: '1rem' }} aria-label="Sender tools">
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Share and sender tools</summary>
            <details><summary>Keep this story</summary>
            <StoryKeepsake story={{ title: creator.content.title, creatorName: creator.brief.creatorName, recipientName: creator.brief.recipientName, dedication: creator.brief.gift?.dedication, scenes: creator.content.scenes.map(scene => ({ title: scene.title, body: scene.body })), message: creator.brief.message }} />
            </details>
            <p>For {creator.brief.recipientName} - about {creator.brief.durationMinutes} minutes.</p>
            <p>{creator.brief.unlockPolicy === 'allow-skip' ? 'Allow a skip: recipients may confirm a reveal without solving.' : 'Solve to unlock: a correct answer is required.'}</p>
            <p>Recipient access expires {new Date(creator.expiresAt).toLocaleString()}. The brief stays in this browser&apos;s library until removed, whether or not anyone finishes.</p>
            {creator.brief.adventure ? <p>{creator.brief.adventure.choiceMode === 'suggested' ? '3-5 suggested actions per turn' : 'Free written or spoken actions'}. Up to 12 per playthrough; {creator.brief.adventure.actionBudget} total AI attempts, including failures.</p> : null}
            <article style={cardStyle}>
              <h2>Listen before sending</h2>
              <p>Scenes and clues only; private answers and reveals excluded. No recipient progress is changed.</p>
              <NarrationButton narrator={narrator} text={sharedStoryPreviewText(creator.content)} label="Listen to the whole story" beforeSpeak={interaction.stopRecording} />
              {!creator.brief.adventure ? <>
                <label>Studio preview scene<select value={Math.min(studioScene, creator.content.scenes.length - 1)} onChange={event => setStudioScene(Number(event.target.value))} style={fieldStyle}>
                  {creator.content.scenes.map((scene, index) => <option key={index} value={index}>Scene {index + 1}: {scene.title}</option>)}
                </select></label>
                <StudioNarration key={`${creator.ownerToken}:${Math.min(studioScene, creator.content.scenes.length - 1)}`}
                  sceneIndex={Math.min(studioScene, creator.content.scenes.length - 1)} owner audioRef={studioAudio}
                  disabled={busy || voiceRecording || voiceUploading} stopSignal={narrator.busy || Boolean(interaction.recordingTarget) || voiceRecording} beforeListen={beforeStudio}
                  check={async (sceneIndex, signal) => studioSceneStatus(await request<StudioResponse>({ action: 'studio-status', token: creator.ownerToken }, creatorCode, signal), sceneIndex)}
                  generate={async (sceneIndex, signal) => studioSceneStatus(await request<StudioResponse>({ action: 'studio-generate', token: creator.ownerToken, sceneIndex, consentVersion: MUSE_AI_CONSENT_VERSION }, creatorCode, signal), sceneIndex)}
                  load={(sceneIndex, signal) => requestStudioAudio({ action: 'studio-audio', token: creator.ownerToken, preview: true, sceneIndex }, signal, creatorCode)} />
              </> : <p>Studio recordings cover prepared stories only. Live AI turns use the separate device voice.</p>}
            </article>
            {creator.content.scenes.map((scene, index) => (
              <details key={index} style={cardStyle}>
                <summary style={{ cursor: 'pointer' }}>Scene {index + 1}: {scene.title}</summary>
                {creator.brief.adventure ? <p>AI adapts this clue to the recipient&apos;s actions.</p> : index + 1 < creator.content.scenes.length ? <>
                  <h3>Recipient exploration actions</h3>
                  <ul>{(scene.choices || ['Follow the next clue', 'Continue exploring the mystery', 'Look for another detail']).map(choice => <li key={choice}>{choice}</li>)}</ul>
                  <p>All actions continue to the same next scene.</p>
                </> : <p>The recipient types the final answer after this clue.</p>}
              </details>
            ))}
            <details style={cardStyle}>
              <summary>Private answer and reveal</summary>
              <p><strong>Answer:</strong> {creator.brief.solution}</p>
              {(creator.brief.alternativeAnswers ?? []).length > 0 ? (
                <><h3>Approved alternative answers</h3><ul>{creator.brief.alternativeAnswers!.map((answer, index) => <li key={index}>{answer}</li>)}</ul></>
              ) : null}
              {(creator.brief.assistanceHints ?? []).length > 0 ? (
                <><h3>Hints, in reveal order</h3><ol>{creator.brief.assistanceHints!.map((hint, index) => <li key={index}>{hint}</li>)}</ol><p>Shown only when requested.</p></>
              ) : null}
              {creator.brief.message ? <>
                <h3>Final message</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{creator.brief.message}</p>
                <NarrationButton narrator={narrator} text={creator.brief.message} label="Preview the final message" beforeSpeak={interaction.stopRecording} context={{ progress: 1, ending: true }} />
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
            <GiftProgress key={creator.ownerToken} sceneCount={creator.content.scenes.length} adventure={Boolean(creator.brief.adventure)}
              load={async () => {
                const result = await request<{ progress: SharedStoryProgress }>({ action: 'progress', token: creator.ownerToken }, creatorCode)
                return result.progress
              }} />
            {creator.brief.gift?.allowReply ? <details style={cardStyle}>
              <summary>Private replies ({replies.length})</summary>
              <p>Only messages recipients choose to send. Replies are separate from the anonymous progress overview above; recipient identities are not verified.</p>
              <button type="button" disabled={busy} style={buttonStyle} onClick={() => void refreshReplies()}>Refresh replies</button>
              {!replies.length ? <p>No replies yet.</p> : replies.map((reply, index) => <article key={index} style={{ borderTop: '1px solid #d9cfc5', marginTop: 12 }}>
                <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{reply.message}</p>
                <p><small>{new Date(reply.createdAt).toLocaleString()}</small></p>
              </article>)}
            </details> : null}
            {!creator.brief.message && !ownerMedia ? <article style={cardStyle}>
              <h2>Share story</h2>
              <p role="status">Attach your photo or video above to unlock sharing.</p>
            </article> : <article style={cardStyle}>
              <h2>Share story</h2>
              <PreSendCheck key={creator.ownerToken} story={creator} hasMedia={Boolean(ownerMedia)} hasVoice={Boolean(ownerVoice)} uploadPending={Boolean(mediaFile || voiceFile || voiceUploading || upload.phase === 'uploading')} onReady={markSendReady} />
              {sendReady === creator.ownerToken && !mediaFile && !voiceFile && !voiceUploading && upload.phase !== 'uploading' && Date.parse(creator.expiresAt) > Date.now() ? <>
              <p>Anyone with the recipient link can play. Keep the management link to yourself. Links expire on {new Date(creator.expiresAt).toLocaleDateString()}.</p>
              <details style={{ marginBottom: '1rem' }}>
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
                    setNotice('Recipient sharing now uses the temporary public address. Management stays local. Check the link before sending.')
                  } catch (error) {
                    setError(error instanceof Error ? error.message : 'Invalid tunnel address.')
                  }
                }}>Use tunnel for recipient links</button>
                {publicOrigin ? <><p role="status">Temporary recipient address: {publicOrigin}</p><button style={buttonStyle} onClick={() => { setPublicOrigin(''); setTunnelAddress(''); setNotice('Recipient links now use the local address again.') }}>Return to local links</button></> : null}
              </details>
              {playerLink ? <>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
                  <a href={playerLink} target="_blank" rel="noopener noreferrer" onClick={event => { if (!confirmShareReady()) event.preventDefault(); narrator.stop() }} style={{ ...primaryStyle, textDecoration: 'none' }}>Open recipient story</a>
                  <button onClick={() => copy(playerLink, true)} style={buttonStyle}>Copy recipient link</button>
                </div>
                <p>Test in a private window for fresh progress.</p>
                <label>Recipient link<input readOnly value={playerLink} style={fieldStyle} onFocus={(event) => event.target.select()} /></label>
              </> : null}
              {shareDetails ? (
                <>
                  {shareDetails.localOnly ? (
                    <p role="status">Local link: works only on this computer. External sharing is disabled.</p>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                      <a href={shareDetails.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={event => { if (!confirmShareReady()) event.preventDefault(); narrator.stop() }} style={{ ...buttonStyle, color: 'inherit' }}>Share on WhatsApp</a>
                      <GiftCard key={playerLink} recipientUrl={shareDetails.url} expiresAt={creator.expiresAt} disabled={busy || sharing} />
                      {canDeviceShare ? <button disabled={busy || sharing} onClick={() => void shareOnDevice()} style={buttonStyle}>{sharing ? 'Opening sharing...' : 'Share with another app'}</button> : null}
                    </div>
                  )}
                  <p>Confirm sending in your sharing app. Only the recipient link is shared, not private answers or reveals. Device voices vary; Studio audio is available only when separately prepared.</p>
                </>
              ) : null}
              <button disabled={busy} onClick={() => creatorAction('share')} style={{ ...buttonStyle, marginTop: '1rem' }}>Replace recipient link (invalidates the previous one)</button>
              </> : null}
            </article>}
            <details style={cardStyle}>
              <summary>Your private management link</summary>
              <input aria-label="Private management link" readOnly value={managementLink} style={fieldStyle} onFocus={(event) => event.target.select()} />
              <button onClick={() => copy(managementLink)} style={{ ...buttonStyle, marginTop: '0.5rem' }}>Copy management link</button>
            </details>
            <details style={{ marginTop: '1.5rem' }}>
              <summary>Delete this story</summary>
              <p>This permanently removes the story and disables both links.</p>
              <button disabled={busy || voiceUploading || voiceRecording} onClick={() => creatorAction('delete')} style={buttonStyle}>Permanently delete story</button>
            </details>
            </details>
          </section>
        ) : (
          <section>
            <p className="atelier-eyebrow">A story to give</p>
            <h1 className="atelier-title" style={{ fontSize: 'clamp(2.2rem, 6vw, 3.6rem)' }}>Create a gift story</h1>
            <p className="atelier-subtitle">Make a story for someone else. They follow the clues to discover your personal surprise.</p>
            <p className="atelier-subtitle">A personal mystery. A surprise worth finding.</p>
            {pendingDraft ? <aside style={cardStyle} aria-label="Saved draft">
              <h2>Pick up where you left off?</h2>
              <p>A draft is saved on this device from {new Date(pendingDraft.savedAt).toLocaleString()}. Voice recordings and media are not saved in drafts.</p>
              <button type="button" style={primaryStyle} onClick={() => {
                setBrief(pendingDraft.brief); setAssistanceHintsText(pendingDraft.assistanceHintsText); setAlternativeAnswersText(pendingDraft.alternativeAnswersText); setCreatorStep(0)
                setPendingDraft(null); setAiConsent(false)
              }}>Restore draft</button>
              <button type="button" style={buttonStyle} onClick={() => {
                try { removeGiftDraft(); setPendingDraft(null); setDraftStatus('Draft discarded.') } catch { setDraftStatus('Could not discard the saved draft. Check browser storage access.') }
              }}>Discard saved draft</button>
            </aside> : null}
            {draftStatus ? <p role="status" style={{ fontSize: '0.9rem' }}>{draftStatus}</p> : null}
            {draftReady && !pendingDraft && !draftUnreadable ? <details style={{ marginBottom: '1rem' }}>
              <summary>Draft privacy</summary>
              <p>Your writing, including the answer and final message, is saved unencrypted in this browser only. Not suitable for a shared device. No files, recordings or consent are saved.</p>
              <button type="button" disabled={busy || voiceRecording} style={buttonStyle} onClick={() => {
                if (!window.confirm('Discard this draft and clear the form? Attached files and recordings will also be removed from this page. Existing sent stories are unchanged.')) return
                try {
                  removeGiftDraft()
                  setBrief({ ...blankBrief }); setAssistanceHintsText(''); setAlternativeAnswersText(''); setCreatorStep(0)
                  setVoiceFile(null); setMediaFile(null); setAiConsent(false); setDraftStatus('Draft discarded.')
                } catch { setDraftStatus('Could not discard the draft. Check browser storage access.') }
              }}>Discard draft and clear form</button>
            </details> : null}
            {draftUnreadable ? <button type="button" style={buttonStyle} onClick={() => {
              try { removeGiftDraft(); setDraftUnreadable(false); setDraftStatus('Unreadable draft discarded.') } catch { setDraftStatus('Could not discard the saved draft. Check browser storage access.') }
            }}>Discard unreadable draft</button> : null}
            <ol aria-label="Story creation steps" style={{ display: 'flex', gap: '0.5rem', listStyle: 'none', padding: 0, margin: '1.5rem 0 0.75rem' }}>
              {['For someone', 'The story', 'The surprise'].map((label, index) => <li key={label} aria-current={creatorStep === index ? 'step' : undefined} style={{ flex: 1, borderTop: `3px solid ${creatorStep === index ? '#70566d' : '#e4dcd4'}`, paddingTop: '0.65rem', color: creatorStep === index ? '#202c42' : '#70566d', fontSize: '0.85rem', fontWeight: creatorStep === index ? 700 : 400 }}>{index + 1}. {label}</li>)}
            </ol>
            <p className="atelier-eyebrow" aria-live="polite">Step {creatorStep + 1} of 3: {['Who it is for', 'Shape the story', 'Your surprise'][creatorStep]}</p>
            <form ref={creatorForm} onSubmit={generate}>
              <fieldset hidden={creatorStep !== 0} disabled={busy || creatorStep !== 0} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              <div style={cardStyle}>
                <h2>1. Who is it for?</h2>
                <p>Choose a moment, then make it personal.</p>
                <div role="group" aria-label="Choose an occasion" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: '1.2rem' }}>
                  {GIFT_OCCASIONS.map(occasion => <button key={occasion.id} type="button" disabled={busy} aria-pressed={brief.gift?.occasion === occasion.id} onClick={() => chooseOccasion(occasion.id)} style={brief.gift?.occasion === occasion.id ? primaryStyle : buttonStyle}>{occasion.label}</button>)}
                  <button type="button" disabled={busy} aria-pressed={!brief.gift} onClick={() => chooseOccasion()} style={!brief.gift ? primaryStyle : buttonStyle}>My own idea</button>
                </div>
                {textField('creatorName', 'Your name', 'Person A', 80)}
                {textField('recipientName', 'Recipient name', 'Person B', 80)}
                <div>
                  <label htmlFor="shared-language" style={{ fontWeight: 700 }}>Story language</label>
                  <select id="shared-language" value={brief.language ?? ''} disabled={busy} style={fieldStyle} onChange={event => {
                    const language = STORY_LANGUAGES.find(item => item.code === event.target.value)
                    if (!language) return
                    setBrief(current => ({ ...current, language: language.code })); setAiConsent(false)
                  }}>
                    {!brief.language ? <option value="">Keep original language (saved brief)</option> : null}
                    {STORY_LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.label}</option>)}
                  </select>
                </div>
                <details>
                  <summary>About story language</summary>
                  <p>Scenes, clues and recipient instructions use this language. Write your dedication, hints, answer and final message in the same language; your words stay unchanged. Settings and errors may remain English.</p>
                </details>
                <RomanceOptions value={brief.romance} onChange={romance => { setBrief(current => ({ ...current, romance })); setAiConsent(false) }} confirmed={romanceConfirmed} onConfirm={setRomanceConfirmed} disabled={busy} showConfirmation={false} />
              </div>
              </fieldset>
              <fieldset hidden={creatorStep !== 1} disabled={busy || creatorStep !== 1} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              <div style={cardStyle}>
                <h2>2. The story</h2>
                {textField('setting', 'Story idea and setting', 'A hidden letter in a room full of clues...', 3000)}
                {textField('goal', 'What should they find or solve?', 'Find the hiding place of the letter.', 600)}
                {textField('recipientHints', selectedOccasion?.question ?? 'Personal touches', selectedOccasion?.placeholder ?? 'Favourite places, shared memories, inside jokes...', 1500, true)}
                <label style={{ fontWeight: 700 }}>Story length
                  <select value={brief.durationMinutes} onChange={(event) => { setBrief({ ...brief, durationMinutes: Number(event.target.value) }); setAiConsent(false) }} style={fieldStyle} disabled={busy}>
                    {SHARED_STORY_DURATIONS.map((duration) => <option key={duration} value={duration}>About {duration} minutes</option>)}
                  </select>
                </label>
                <label style={{ fontWeight: 700 }}>How should the recipient interact?
                  <select aria-label="Story interaction" value={brief.adventure ? brief.adventure.choiceMode ?? 'free' : 'classic'} disabled={busy} onChange={event => {
                    const mode = event.target.value
                    setBrief(current => {
                      const { adventure, ...rest } = current
                      return mode === 'classic' ? rest : { ...rest, adventure: { actionBudget: adventure?.actionBudget ?? 12, choiceMode: mode === 'suggested' ? 'suggested' : 'free' } }
                    })
                    setAiConsent(false)
                  }} style={fieldStyle}>
                    <option value="classic">Classic clues (no live AI)</option>
                    <option value="free">Write or speak freely (live AI)</option>
                    <option value="suggested">Choose from 3-5 actions (live AI)</option>
                  </select>
                </label>
                {brief.adventure ? <>
                  <label htmlFor="adventure-budget">Total live AI action budget (all recipients)
                    <input id="adventure-budget" type="number" min={1} max={1000} value={brief.adventure.actionBudget || ''} disabled={busy} onChange={event => { setBrief({ ...brief, adventure: { ...brief.adventure!, actionBudget: Number(event.target.value) } }); setAiConsent(false) }} style={fieldStyle} />
                  </label>
                  <p>1-1000 total attempts; up to 12 per playthrough. Failures count. Preparation is separate; hints, guesses and browser audio use no action attempts.</p>
                </> : <p>All choices follow the same prepared clue trail.</p>}
              </div>
              </fieldset>
              <fieldset hidden={creatorStep !== 2} disabled={busy || creatorStep !== 2} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              <details style={cardStyle}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Personalize the gift story (optional)</summary>
                {!brief.gift ? <p>Choose an occasion above to add a personal opening and optional replies.</p> : <>
                  <label htmlFor="gift-dedication" style={{ display: 'block', marginTop: '1rem', fontWeight: 700 }}>A note on the cover
                    <textarea id="gift-dedication" value={brief.gift.dedication} maxLength={240} rows={2} style={fieldStyle} placeholder="A little adventure, just for you." disabled={busy} onChange={event => { setBrief({ ...brief, gift: { ...brief.gift!, dedication: event.target.value } }); setAiConsent(false) }} />
                  </label>
                  <p>Visible before solving. Keep the secret answer and final surprise out of this note.</p>
                  <label style={{ display: 'block', padding: '0.75rem 0' }}><input type="checkbox" checked={brief.gift.allowReply} disabled={busy} onChange={event => { setBrief({ ...brief, gift: { ...brief.gift!, allowReply: event.target.checked } }); setAiConsent(false) }} /> Let them send a private thank-you after the reveal</label>
                </>}
                <GiftVoiceRecorder file={voiceFile} onChange={file => { setVoiceFile(file); setAiConsent(false) }} disabled={busy} onActiveChange={setVoiceRecording} beforeRecord={() => { narrator.stop(); interaction.stopRecording() }} />
              </details>
              <div style={cardStyle}>
                <h2>The secret answer</h2>
                {textField('solution', 'Secret answer', 'The exact answer, e.g. behind the blue notebook', 200)}
                <p>Case, punctuation and spacing ignored. Add alternatives below.</p>
              </div>
              <div style={cardStyle}>
                <h2>The final reveal</h2>
                <p>Message, photo or video: revealed after a correct answer, or a confirmed skip if you allow it.</p>
                <label style={{ fontWeight: 700 }}>How can the surprise be unlocked?
                  <select aria-label="Reveal policy" value={brief.unlockPolicy ?? 'solve'} disabled={busy} onChange={event => {
                    setBrief({ ...brief, unlockPolicy: event.target.value === 'allow-skip' ? 'allow-skip' : 'solve' })
                    setAiConsent(false)
                  }} style={fieldStyle}>
                    <option value="solve">Solve to unlock</option>
                    <option value="allow-skip">Allow a skip</option>
                  </select>
                </label>
                <p>Allow a skip adds an optional, confirmed reveal under Need help. Skipping never reveals the secret answer or counts as solving; hints and skips make no AI calls.</p>
                {textField('message', 'Final message', 'Your hidden message...', 2000, Boolean(mediaFile))}
                <label style={{ fontWeight: 700 }}>Photo or video (optional)
                  <input type="file" accept={SHARED_MEDIA_ACCEPT} disabled={busy} onChange={event => { chooseFile(event.target.files?.[0] ?? null); setAiConsent(false); event.target.value = '' }} style={fieldStyle} />
                </label>
                {mediaFile ? <p role="status">Selected: {mediaFile.name} ({formatMediaSize(mediaFile.size)}). <button type="button" disabled={busy} onClick={() => chooseFile(null)} style={{ ...buttonStyle, fontSize: '0.85rem' }}>Remove file</button></p> : null}
                <p>One file: JPEG/PNG/WebP up to {formatMediaSize(SHARED_MEDIA_PHOTO_MAX_BYTES)}; MP4/WebM up to {formatMediaSize(SHARED_MEDIA_VIDEO_MAX_BYTES)}. Uploaded privately after preparation, never sent to AI. No video autoplay.</p>
              </div>
              <details style={cardStyle}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Style, alternative answers and hints</summary>
                <div style={{ marginTop: '1rem' }}>
                  {textField('narration', 'Narration style', DEFAULT_NARRATION, 600, true)}
                  {assistanceField('alternativeAnswers', 'Accepted alternative answers', 'These also unlock the reveal.', 5, 200)}
                  {assistanceField('assistanceHints', 'Hints', 'Gentle to strong. Shown on request; no scene advance or guesses used.', 3, 600)}
                </div>
              </details>
              <details style={{ marginBottom: '1rem' }}>
                <summary>Privacy and limits</summary>
                <p>Your written brief, including answers, hints and message, goes to the configured AI provider and stays on the server for up to 30 days. Media goes only to private storage and is deleted with the story. Hints need no AI calls. Avoid confidential or sensitive details about others.</p>
                <p>Expired records may be physically cleaned only when later requests trigger cleanup. Backups are retained separately.</p>
                <p>Generation is limited to 5 requests per hour per connection and 100 per day across the prototype. Each story allows {SHARED_MEDIA_ATTEMPTS_PER_STORY} photo/video upload attempts.</p>
              </details>
              {brief.romance ? <label style={{ display: 'block', padding: '1rem 0', lineHeight: 1.7 }}>
                <input type="checkbox" checked={romanceConfirmed} disabled={busy} onChange={event => setRomanceConfirmed(event.target.checked)} /> {romanceCopy().creatorConfirmation}
              </label> : null}
              <ExplicitConsent checked={aiConsent} onChange={setAiConsent}>
                I understand that my written brief (including names, personal hints, answers and message) will be sent to Muse&apos;s configured AI provider and the story kept on Muse&apos;s server for up to 30 days. Any photo, video or voice recording is stored privately and is not sent to AI.
              </ExplicitConsent>
              <button disabled={busy || voiceRecording || Boolean(pendingDraft) || draftUnreadable} style={{ ...primaryStyle, width: '100%' }}>{busy ? upload.phase === 'uploading' ? `Uploading your ${mediaFile?.type.startsWith('video/') ? 'video' : 'photo'}… ${upload.progress}%` : 'Muse is preparing the mystery...' : 'Prepare story with AI'}</button>
              </fieldset>
              <div style={{ display: 'flex', gap: 12, margin: '1rem 0' }}>
                {creatorStep > 0 ? <button type="button" disabled={busy || voiceRecording} onClick={() => { setCreatorStep(step => step - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={buttonStyle}>Back</button> : null}
                {creatorStep < 2 ? <button type="button" disabled={busy || Boolean(pendingDraft) || draftUnreadable} onClick={nextCreatorStep} style={{ ...primaryStyle, flex: 1 }}>Continue</button> : null}
              </div>
            </form>
          </section>
        )}
      </div>
    </main>
  )
}

import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { SHARED_STORY_DURATIONS, type SharedStoryBrief, type SharedStoryPlayer } from '../lib/sharedStory'
import { latestCreatorStory, loadStoryLibrary, removeLibraryEntry, saveLibraryCreatorStory, type CreatorStory } from '../lib/storyLibrary'
import { useStoryInteraction } from '../lib/useStoryInteraction'
import MicrophoneCheck from '../components/MicrophoneCheck'
import { recipientShareDetails, sharedStoryPreviewText } from '../lib/sharedStorySharing'
import { useNarration } from '../lib/useNarration'
import NarrationControls, { NarrationButton } from '../components/NarrationControls'
import SharedStoryReveal, { type RevealMedia } from '../components/SharedStoryReveal'
import ExplicitConsent from '../components/ExplicitConsent'
import { hasExplicitConsent, MUSE_AI_CONSENT_VERSION } from '../lib/legalContact'
import {
  formatMediaSize, parseMediaDeclaration, SHARED_MEDIA_ACCEPT, SHARED_MEDIA_ATTEMPTS_PER_STORY, SHARED_MEDIA_PHOTO_MAX_BYTES, SHARED_MEDIA_VIDEO_MAX_BYTES,
  type SharedMediaKind, type SharedMediaSummary
} from '../lib/sharedStoryMedia'

type PlayerResponse = { player: SharedStoryPlayer; sessionToken: string }
type MediaState = { media: SharedMediaSummary | null; mediaRequired: boolean }
type UploadTarget = { method: 'PUT'; url: string; headers: Record<string, string> }
type UploadState = { phase: 'idle' | 'uploading' | 'failed'; progress: number; error?: string }

const fieldStyle: CSSProperties = { display: 'block', width: '100%', padding: '0.85rem', marginTop: '0.5rem', boxSizing: 'border-box', fontSize: '1rem', border: '1px solid #d9cfc5', borderRadius: 8, background: '#fff' }
const cardStyle: CSSProperties = { padding: '1.5rem', border: '1px solid #d9cfc5', borderRadius: 18, background: '#fffaf6', marginBottom: '1rem' }
const buttonStyle: CSSProperties = { padding: '0.8rem 1.1rem', borderRadius: 999, border: '1px solid #d9cfc5', cursor: 'pointer', fontSize: '1rem' }
const primaryStyle: CSSProperties = { ...buttonStyle, background: '#2d2926', color: '#fffaf6' }
const DEFAULT_NARRATION = 'A warm, playful mystery told in the second person, with gentle suspense.'
const blankBrief: SharedStoryBrief = { creatorName: '', recipientName: '', narration: DEFAULT_NARRATION, setting: '', recipientHints: '', goal: '', solution: '', message: '', durationMinutes: 5, assistanceHints: [], alternativeAnswers: [] }
const idleUpload: UploadState = { phase: 'idle', progress: 0 }
const mediaLabel = (kind: SharedMediaKind) => kind === 'video' ? 'video' : 'photo'
type AssistanceField = 'assistanceHints' | 'alternativeAnswers'
const assistanceLines = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)

async function request<T>(body: Record<string, unknown>, creatorCode = ''): Promise<T> {
  const response = await fetch('/api/shared-story', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(creatorCode ? { 'x-muse-creator-code': creatorCode } : {}) }, body: JSON.stringify(body)
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Could not complete the story request.')
  return data as T
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
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [origin, setOrigin] = useState('')
  const [tunnelAddress, setTunnelAddress] = useState('')
  const [publicOrigin, setPublicOrigin] = useState('')
  const [canDeviceShare, setCanDeviceShare] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [dictationLanguage, setDictationLanguage] = useState('en-US')
  const [experience, setExperience] = useState<'read' | 'listen'>('read')
  const [creatorCodeInput, setCreatorCodeInput] = useState('')
  const [creatorCode, setCreatorCode] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [upload, setUpload] = useState<UploadState>(idleUpload)
  const [ownerMedia, setOwnerMedia] = useState<SharedMediaSummary | null>(null)
  const [ownerPreview, setOwnerPreview] = useState<RevealMedia | null>(null)
  const [revealMedia, setRevealMedia] = useState<RevealMedia | null>(null)
  const objectUrls = useRef<string[]>([])
  const lastMediaRefresh = useRef(0)
  const creatorLocked = process.env.NEXT_PUBLIC_MUSE_CREATOR_LOCKED === 'true'
  const narrator = useNarration(player || creator?.content || {}, undefined, {
    progress: player?.adventure ? player.adventure.actionsUsed / 12
      : player ? player.sceneIndex / Math.max(1, player.sceneCount - 1) : 0,
    ending: player?.solved,
    sceneKey: player ? `${playToken}:${player.adventure?.revision ?? player.sceneIndex}:${player.solved}`
      : creator?.ownerToken || 'new'
  })
  const interaction = useStoryInteraction(narrator.stop, dictationLanguage)

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
          const result = await request<PlayerResponse>({ action: 'open', token: recipientToken, ...(savedSession ? { sessionToken: savedSession } : {}) })
          if (!active) return
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
        const requestedOwner = fragment.get('manage')
        const matching = libraryResult.library.entries.find(entry => entry.kind === 'shared' && entry.id === requestedOwner)
        const saved = matching?.kind === 'shared' ? matching.story : latestCreatorStory(libraryResult)
        const ownerToken = fragment.get('manage') || (fragment.has('new') ? null : saved?.ownerToken)
        if (ownerToken) {
          const { media, mediaRequired: _required, ...result } = await request<Omit<CreatorStory, 'ownerToken' | 'playToken'> & MediaState>({ action: 'manage', token: ownerToken }, creatorCode)
          if (!active) return
          const restored = { ...result, ownerToken, ...(saved?.ownerToken === ownerToken ? { playToken: saved.playToken } : {}) }
          setCreator(restored)
          setOwnerMedia(media ?? null)
          setBrief(result.brief)
          setAssistanceHintsText((result.brief.assistanceHints ?? []).join('\n'))
          setAlternativeAnswersText((result.brief.alternativeAnswers ?? []).join('\n'))
          try {
            saveLibraryCreatorStory(restored)
          } catch (error) {
            setNotice(`${error instanceof Error ? error.message : 'This browser could not save your management link.'} Keep a copy of your private management link yourself.`)
          }
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
    if (busy || !creator) return
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
    setOwnerMedia(null)
    setOwnerPreview(null)
    setMediaFile(null)
    setUpload(idleUpload)
    setAiConsent(false)
    setError('')
    setNotice('Your previous story is in Story Library. Its recipient link and progress are unchanged.')
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
      const declaration = parseMediaDeclaration({ mime: file.type, size: file.size })
      const started = await request<{ uploadId: string; upload: UploadTarget }>({ action: 'media-start', token: story.ownerToken, media: { mime: declaration.mime, size: declaration.size } }, creatorCode)
      uploadId = started.uploadId
      await putFile(started.upload, file, creatorCode, progress => setUpload({ phase: 'uploading', progress }))
      const finished = await request<MediaState>({ action: 'media-finish', token: story.ownerToken, uploadId }, creatorCode)
      uploadId = ''
      setOwnerMedia(finished.media)
      setOwnerPreview(null)
      setMediaFile(null)
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

  const loadRevealMedia = useCallback(async (kind: SharedMediaKind) => {
    setRevealMedia(current => current?.url ? current : { kind, state: 'loading' })
    try {
      const result = await requestMedia({ action: 'media', token: playToken, sessionToken })
      setRevealMedia({ kind, state: 'ready', url: mediaUrl(result) })
    } catch {
      setRevealMedia({ kind, state: 'error' })
    }
  }, [playToken, sessionToken])

  const solvedMediaKind = player?.solved ? player.media?.kind : undefined
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

  const generate = async (event: FormEvent) => {
    event.preventDefault()
    if (!hasExplicitConsent(aiConsent)) {
      setError('Review the AI disclosure and check the consent box before preparing this story.')
      return
    }
    setAiConsent(false)
    setBusy(true)
    setError('')
    setNotice('')
    interaction.stopRecording()
    narrator.stop()
    try {
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
      const { media: _media, mediaRequired: _required, ...story } = await request<CreatorStory & MediaState>({
        action: 'create', brief: preparedBrief, consentVersion: MUSE_AI_CONSENT_VERSION,
        ...(declaration ? { finalMedia: { mime: declaration.mime, size: declaration.size } } : {})
      }, creatorCode)
      setBrief(story.brief)
      setAssistanceHintsText((story.brief.assistanceHints ?? []).join('\n'))
      setAlternativeAnswersText((story.brief.alternativeAnswers ?? []).join('\n'))
      setOwnerMedia(null)
      setOwnerPreview(null)
      storeCreator(story)
      window.history.replaceState(null, '', `/shared#manage=${story.ownerToken}`)
      if (mediaFile) await uploadMedia(story, mediaFile)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not generate the story.')
    } finally {
      setBusy(false)
    }
  }

  const act = async (action: 'guess' | 'next' | 'hint') => {
    setBusy(true)
    setError('')
    interaction.stopRecording()
    narrator.stop()
    try {
      const result = await request<PlayerResponse>({ action, token: playToken, sessionToken, ...(action === 'guess' ? { guess } : {}) })
      setPlayer(result.player)
      if (action !== 'hint') setGuess('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not continue the story.')
    } finally {
      setBusy(false)
    }
  }

  const adventureAction = async (refresh = false, selectedChoice?: string) => {
      if (!player?.adventure) return
      if (!refresh && !hasExplicitConsent(aiConsent)) {
        setError('Review the AI disclosure and check the consent box before sending this action.')
        return
      }
      if (!refresh) setAiConsent(false)
      setBusy(true)
      setError('')
      interaction.stopRecording()
      narrator.stop()
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
        const response = await fetch('/api/shared-story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission) })
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

  const copy = async (value: string) => {
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

  const textField = (key: Exclude<keyof SharedStoryBrief, 'durationMinutes' | 'adventure' | AssistanceField>, label: string, placeholder: string, max: number, optional = false) => (
    <div style={{ marginBottom: '1.2rem' }}>
      <label htmlFor={`brief-${key}`} style={{ fontWeight: 700 }}>{label}{optional ? ' (optional)' : ''}</label>
      <textarea id={`brief-${key}`} required={!optional} value={brief[key]} onChange={(event) => { setBrief({ ...brief, [key]: event.target.value }); setAiConsent(false) }} rows={key === 'setting' || key === 'message' ? 4 : 2} maxLength={max} placeholder={placeholder} style={fieldStyle} disabled={busy} />
      <button type="button" aria-label={interaction.recordingTarget === key ? `Stop dictation: ${label}` : `Dictate: ${label}`} disabled={busy} onClick={() => interaction.dictate(key, (value) => { setBrief((current) => ({ ...current, [key]: value.slice(0, max) })); setAiConsent(false) }, key === 'creatorName' || key === 'recipientName')} style={{ ...buttonStyle, marginTop: '0.5rem', fontSize: '0.85rem' }}>
        {interaction.recordingTarget === key ? 'Stop dictation' : 'Dictate'}
      </button>
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

  const audioButton = (text: string) => <NarrationButton narrator={narrator} text={text} beforeSpeak={interaction.stopRecording} />

  const shareDetails = origin && creator?.playToken ? recipientShareDetails(publicOrigin || origin, creator.playToken) : null
  const playerLink = shareDetails?.url || ''
  const managementLink = creator ? `${origin}/shared#manage=${creator.ownerToken}` : ''
  const adventureCanSubmit = Boolean(player?.adventure &&
    (player.adventure.pending || (player.adventure.actionsRemaining > 0 && player.adventure.budgetRemaining > 0)))

  const shareOnDevice = async () => {
    if (!shareDetails || shareDetails.localOnly || sharing) return
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
    <main style={{ minHeight: '100vh', background: '#f7f3ed', color: '#2d2926', fontFamily: 'Georgia, serif' }}>
      <Head>
        <title>Muse - Shared Story</title>
        <meta name="description" content="Give Muse your idea and personal clues. Create a mystery for someone else to solve." />
        <meta name="referrer" content="no-referrer" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div style={{ maxWidth: 850, margin: '0 auto', padding: '1.5rem' }}>
        <header style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
          <Link href="/" style={{ color: 'inherit', fontWeight: 700 }}>MUSE</Link>
          {!playToken ? <nav style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link href="/myself" style={{ color: 'inherit' }}>Myself</Link>
            <Link href="/story" style={{ color: 'inherit' }}>My Story</Link>
            <Link href="/shared" style={{ color: 'inherit' }}>Shared Story</Link>
            <Link href="/library" style={{ color: 'inherit' }}>Story Library</Link>
          </nav> : null}
        </header>
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
        <details style={{ marginBottom: '1rem' }}>
          <summary>Audio and microphone settings</summary>
          <NarrationControls narrator={narrator} beforeSpeak={interaction.stopRecording} />
          <section aria-label="Voice input settings">
          <p>Dictation fills editable text, not a saved recording. It may use your browser&apos;s online speech service.</p>
          <label>Dictation language <select value={dictationLanguage} onChange={event => { interaction.stopRecording(); setDictationLanguage(event.target.value) }}>
            <option value="en-US">English</option><option value="it-IT">Italian</option><option value="de-DE">German</option><option value="fr-FR">French</option><option value="es-ES">Spanish</option>
          </select></label>
          <MicrophoneCheck stopSignal={interaction.recordingTarget} beforeTest={() => { interaction.stopRecording(); narrator.stop() }} />
          </section>
        </details>
        {loading ? <p role="status">Opening your private story...</p> : creatorLocked && !playToken && !creatorCode ? <p>Recipients need only their story link.</p> : playToken ? player ? (
          <section>
            <p>A story from {player.creatorName} for {player.recipientName}</p>
            <h1 style={{ fontSize: '2.5rem' }}>{player.title}</h1>
            <p style={{ lineHeight: 1.7 }}>{player.description}</p>
            <p>About {player.durationMinutes} minutes, at your pace.</p>
            <div role="group" aria-label="Story experience" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <button aria-pressed={experience === 'read'} onClick={() => { narrator.stop(); setExperience('read') }} style={experience === 'read' ? primaryStyle : buttonStyle}>Read the story</button>
              <button aria-pressed={experience === 'listen'} onClick={() => { narrator.stop(); setExperience('listen') }} style={experience === 'listen' ? primaryStyle : buttonStyle}>Listen to the story</button>
            </div>
            {experience === 'listen' ? <p>Tap Play to listen.</p> : null}
            {player.solved ? (
              <article style={cardStyle}>
                <SharedStoryReveal message={player.message} media={player.media ? revealMedia ?? { kind: player.media.kind, state: 'loading' } : null}
                  narrator={narrator} beforeSpeak={interaction.stopRecording} onMediaError={refreshRevealMedia}
                  onRetryMedia={player.media ? () => void loadRevealMedia(player.media!.kind) : undefined} />
                {player.adventure?.turn ? <><h3>Your completed journey</h3><p>{player.adventure.turn.narration}</p><p>{player.adventure.turn.state.progress}</p></> : null}
              </article>
            ) : (
              <>
              {player.adventure ? <article style={cardStyle}>
                <h2>{player.adventure.turn ? 'Your adventure continues' : player.scene.title}</h2>
                <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{player.adventure.turn?.narration || player.scene.body}</p>
                <NarrationButton narrator={narrator} text={player.adventure.turn?.narration || `${player.scene.body} ${player.scene.clue}`} label="Play adventure narration" beforeSpeak={interaction.stopRecording} />
                <p>Actions left: {player.adventure.actionsRemaining}/12. Shared AI budget: {player.adventure.budgetRemaining}/{player.adventure.budget}.</p>
                <p>Each action uses one attempt, even if it fails. Guesses, hints and browser audio use none.</p>
                {player.adventure.turn ? <section aria-label="Adventure state">
                  <h3>Your journey</h3><p>{player.adventure.turn.state.progress}</p>
                  {(['inventory', 'discoveries', 'relationships'] as const).map(key => <div key={key}><h4>{key}</h4><ul>{player.adventure!.turn!.state[key].map(item => <li key={item}>{item}</li>)}</ul></div>)}
                </section> : null}
                {adventureCanSubmit ? <ExplicitConsent checked={aiConsent} onChange={setAiConsent}>
                  I understand this action is sent to Muse&apos;s configured AI provider to generate the next turn, and the shared story is kept on Muse&apos;s server for up to 30 days.
                </ExplicitConsent> : null}
                {adventureCanSubmit ? player.adventure.choiceMode === 'suggested' ? <section aria-label="Suggested actions">
                  <h3>What do you do next?</h3>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>{player.adventure.choices?.map(choice => <button key={choice} disabled={busy || player.adventure?.pending} onClick={() => void adventureAction(false, choice)} style={{ ...buttonStyle, textAlign: 'left' }}>{choice}</button>)}</div>
                  {!player.adventure.choices?.length && !player.adventure.pending ? <p>Refresh progress to load the current actions.</p> : null}
                  {player.adventure.pending ? <button disabled={busy} onClick={() => void adventureAction()} style={buttonStyle}>Check same submission (no new attempt)</button> : null}
                </section> : <form onSubmit={event => { event.preventDefault(); void adventureAction() }}>
                  <label htmlFor="adventure-action">What do you do?<textarea id="adventure-action" value={actionText} onChange={event => { setActionText(event.target.value); setAiConsent(false) }} maxLength={800} rows={3} style={fieldStyle} disabled={busy} /></label>
                  <p>Review your text before sending.</p>
                  <button type="button" disabled={busy} onClick={() => interaction.dictate('adventure-action', value => { setActionText(value.slice(0, 800)); setAiConsent(false) })} style={buttonStyle}>{interaction.recordingTarget === 'adventure-action' ? 'Stop dictation' : 'Dictate action'}</button>
                  {interaction.recordingTarget === 'adventure-action' ? <p role="status">{interaction.ready ? 'Listening - speak now; review the text before submitting.' : 'Starting microphone - please wait.'}</p> : null}
                  <button disabled={busy || (!actionText.trim() && !player.adventure.pending)} style={primaryStyle}>{player.adventure.pending ? 'Retry same submission / check status' : 'Submit action (uses one attempt)'}</button>
                </form> : <p>Action limit reached. Use hints or try the final answer below. You can still listen.</p>}
                {player.adventure.pending ? <p role="status">Processing. Disconnected attempts expire within 90 seconds without a refund.</p> : null}
                <button disabled={busy} onClick={() => void adventureAction(true)} style={buttonStyle}>Refresh adventure progress</button>
              </article> : <article style={cardStyle}>
                  <p>Scene {player.sceneIndex + 1} of {player.sceneCount}</p>
                  <h2>{player.scene.title}</h2>
                  {experience === 'read' ? <>
                    <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{player.scene.body}</p>
                    <p style={{ lineHeight: 1.7 }}><strong>Clue:</strong> {player.scene.clue}</p>
                  </> : <details><summary>Show scene transcript and clue</summary><p style={{ lineHeight: 1.8 }}>{player.scene.body}</p><p><strong>Clue:</strong> {player.scene.clue}</p></details>}
                  <NarrationButton narrator={narrator} text={`${player.scene.title}. ${player.scene.body} ${player.scene.clue}`} label="Play this scene" beforeSpeak={interaction.stopRecording} />
                  {player.sceneIndex + 1 < player.sceneCount ? <>
                    <h3>What would you like to do next?</h3>
                    <p>All choices follow the same clue trail.</p>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {(player.scene.choices || ['Follow the next clue', 'Continue exploring the mystery', 'Look for another detail']).map(choice => <button key={choice} disabled={busy} onClick={() => void act('next')} style={{ ...buttonStyle, textAlign: 'left' }}>{busy ? 'Opening the next scene...' : choice}</button>)}
                    </div>
                  </> : <p>Final clue. Try your answer below.</p>}
                </article>}
                {player.discoveries.length > 0 ? (
                  <details style={cardStyle}>
                    <summary>Earlier discoveries ({player.discoveries.length})</summary>
                    {player.discoveries.map((scene, index) => (
                      <article key={index}>
                        <h3>{scene.title}</h3>
                        <p style={{ lineHeight: 1.8 }}>{scene.body}</p>
                        <p><strong>Clue:</strong> {scene.clue}</p>
                        {audioButton(`${scene.body} ${scene.clue}`)}
                      </article>
                    ))}
                  </details>
                ) : null}
                <form onSubmit={(event) => { event.preventDefault(); void act('guess') }} style={cardStyle}>
                  <label style={{ fontWeight: 700 }}>What is the answer?<input value={guess} onChange={(event) => setGuess(event.target.value)} maxLength={200} required style={fieldStyle} disabled={busy} /></label>
                  <p>Your guess is sent to Muse to compare with the creator&apos;s answer, not to AI. Only creator-approved answers unlock the surprise. Case, punctuation and spacing are ignored.</p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button disabled={busy || !guess.trim()} style={primaryStyle}>{busy ? 'Checking...' : 'Try this answer'}</button>
                    <button type="button" disabled={busy} onClick={() => interaction.dictate('guess', (value) => setGuess(value.slice(0, 200)))} style={buttonStyle}>{interaction.recordingTarget === 'guess' ? 'Stop dictation' : 'Dictate your answer'}</button>
                  </div>
                  <p>Review before sending. Up to 30 guesses.</p>
                  {interaction.recordingTarget === 'guess' ? <p role="status">{interaction.ready ? 'Listening - speak now.' : 'Starting microphone - please wait.'}</p> : null}
                </form>
              </>
            )}
            {(player.revealedHints.length > 0 || (!player.solved && player.hintsRemaining > 0)) ? (
              <article style={cardStyle}>
                <h2>Hints</h2>
                {player.revealedHints.length > 0 ? (
                  <ol>{player.revealedHints.map((hint, index) => <li key={index} style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{hint}</li>)}</ol>
                ) : <p>Hints use no guesses and do not advance the story.</p>}
                {!player.solved && player.hintsRemaining > 0 ? (
                  <button disabled={busy} onClick={() => void act('hint')} style={buttonStyle}>Request next hint ({player.hintsRemaining} remaining)</button>
                ) : player.hintsRemaining === 0 ? <p>All available hints have been revealed.</p> : null}
              </article>
            ) : null}
            {player.feedback ? <p role="status">{player.feedback}</p> : null}
          </section>
        ) : <p>Could not open the story. Check the link or ask its creator for a new one.</p> : creator ? (
          <section>
            <p>Private creator preview</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button disabled={busy} onClick={() => startNewStory()} style={primaryStyle}>Create new story</button>
              <button disabled={busy} onClick={() => startNewStory(true)} style={buttonStyle}>Reuse this brief</button>
            </div>
            <p>Sent stories stay active. Reopen them from <Link href="/library">Story Library</Link>.</p>
            <h1>{creator.content.title}</h1>
            <p>{creator.content.description}</p>
            <p>For {creator.brief.recipientName} - about {creator.brief.durationMinutes} minutes.</p>
            {creator.brief.adventure ? <p>{creator.brief.adventure.choiceMode === 'suggested' ? '3-5 suggested actions per turn' : 'Free written or spoken actions'}. Up to 12 per playthrough; {creator.brief.adventure.actionBudget} total AI attempts, including failures.</p> : null}
            <article style={cardStyle}>
              <h2>Listen before sending</h2>
              <p>Scenes and clues only; private answers and reveals excluded. No recipient progress is changed.</p>
              <NarrationButton narrator={narrator} text={sharedStoryPreviewText(creator.content)} label="Listen to the whole story" beforeSpeak={interaction.stopRecording} />
            </article>
            {creator.content.scenes.map((scene, index) => (
              <details key={index} style={cardStyle}>
                <summary style={{ cursor: 'pointer' }}>Scene {index + 1}: {scene.title}</summary>
                <p style={{ lineHeight: 1.8 }}>{scene.body}</p>
                <p><strong>Clue:</strong> {scene.clue}</p>
                {creator.brief.adventure ? <p>AI adapts this clue to the recipient&apos;s actions.</p> : index + 1 < creator.content.scenes.length ? <>
                  <h3>Recipient exploration actions</h3>
                  <ul>{(scene.choices || ['Follow the next clue', 'Continue exploring the mystery', 'Look for another detail']).map(choice => <li key={choice}>{choice}</li>)}</ul>
                  <p>All actions continue to the same next scene.</p>
                </> : <p>The recipient types the final answer after this clue.</p>}
                {audioButton(`${scene.body} ${scene.clue}`)}
              </details>
            ))}
            <article style={cardStyle}>
              <h2>Private answer and reveal</h2>
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
            </article>
            {!creator.brief.message && !ownerMedia ? <article style={cardStyle}>
              <h2>Share story</h2>
              <p role="status">Attach your photo or video above to unlock sharing.</p>
            </article> : <article style={cardStyle}>
              <h2>Share story</h2>
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
                  <a href={playerLink} target="_blank" rel="noopener noreferrer" onClick={narrator.stop} style={{ ...primaryStyle, textDecoration: 'none' }}>Open recipient story</a>
                  <button onClick={() => copy(playerLink)} style={buttonStyle}>Copy recipient link</button>
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
                      <a href={shareDetails.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={narrator.stop} style={{ ...buttonStyle, color: 'inherit' }}>Share on WhatsApp</a>
                      {canDeviceShare ? <button disabled={busy || sharing} onClick={() => void shareOnDevice()} style={buttonStyle}>{sharing ? 'Opening sharing...' : 'Share with another app'}</button> : null}
                    </div>
                  )}
                  <p>Confirm sending in your sharing app. Only the recipient link is shared, not private answers or reveals. Audio uses their device&apos;s voices.</p>
                </>
              ) : null}
              <details style={{ marginTop: '1rem' }}>
                <summary>Your private management link</summary>
                <input aria-label="Private management link" readOnly value={managementLink} style={fieldStyle} onFocus={(event) => event.target.select()} />
                <button onClick={() => copy(managementLink)} style={{ ...buttonStyle, marginTop: '0.5rem' }}>Copy management link</button>
              </details>
              <button disabled={busy} onClick={() => creatorAction('share')} style={{ ...buttonStyle, marginTop: '1rem' }}>Replace recipient link (invalidates the previous one)</button>
            </article>}
            <details style={{ marginTop: '1.5rem' }}>
              <summary>Delete this story</summary>
              <p>This permanently removes the story and disables both links.</p>
              <button disabled={busy} onClick={() => creatorAction('delete')} style={buttonStyle}>Permanently delete story</button>
            </details>
          </section>
        ) : (
          <section>
            <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 3.6rem)' }}>Your idea, their discovery.</h1>
            <p style={{ fontSize: '1.1rem', lineHeight: 1.7 }}>Create a mystery with a hidden surprise.</p>
            <form onSubmit={generate}>
              <div style={cardStyle}>
                <h2>1. Who is it for?</h2>
                {textField('creatorName', 'Your name', 'Person A', 80)}
                {textField('recipientName', 'Recipient name', 'Person B', 80)}
              </div>
              <div style={cardStyle}>
                <h2>2. The story</h2>
                {textField('setting', 'Story idea and setting', 'A hidden letter in a room full of clues...', 3000)}
                {textField('goal', 'What should they find or solve?', 'Find the hiding place of the letter.', 600)}
                {textField('recipientHints', 'Personal touches', 'Favourite places, shared memories, inside jokes...', 1500, true)}
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
              <div style={cardStyle}>
                <h2>3. The secret answer</h2>
                {textField('solution', 'Secret answer', 'The exact answer, e.g. behind the blue notebook', 200)}
                <p>Case, punctuation and spacing ignored. Add alternatives below.</p>
              </div>
              <div style={cardStyle}>
                <h2>4. The final reveal</h2>
                <p>Message, photo or video: revealed after a correct answer.</p>
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
              <ExplicitConsent checked={aiConsent} onChange={setAiConsent}>
                I understand that my written brief (including names, personal hints, answers and message) will be sent to Muse&apos;s configured AI provider and the story kept on Muse&apos;s server for up to 30 days. Any photo or video is stored privately and is not sent to AI.
              </ExplicitConsent>
              <button disabled={busy} style={{ ...primaryStyle, width: '100%' }}>{busy ? upload.phase === 'uploading' ? `Uploading your ${mediaFile?.type.startsWith('video/') ? 'video' : 'photo'}… ${upload.progress}%` : 'Muse is preparing the mystery...' : 'Prepare story with AI'}</button>
            </form>
          </section>
        )}
      </div>
    </main>
  )
}

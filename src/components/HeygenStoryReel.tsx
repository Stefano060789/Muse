import { useEffect, useRef, useState } from 'react'
import { accountFetch } from '../lib/accountClient'
import { videoBlob } from '../lib/chapterVideoClient'
import type { PersonalStory } from '../lib/story'
import type { StoryLanguageCode } from '../lib/storyLanguage'

type ReelStory = Pick<PersonalStory, 'id' | 'title' | 'scenes' | 'responses' | 'currentStep' | 'journey'>
const consentVersion = 'heygen-reel-2026-11'

async function photoData(photo: File): Promise<{ mime: string; data: string }> {
  const image = await createImageBitmap(photo)
  let encoded: Blob | null = null
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context || !image.width || !image.height) throw new Error('Could not prepare the selected photo.')
    for (const longest of [1600, 1200, 900, 675]) {
      const scale = Math.min(1, longest / Math.max(image.width, image.height))
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.85, 0.7, 0.55]) {
        encoded = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
        if (encoded && encoded.type === 'image/jpeg' && encoded.size > 0 && encoded.size <= 700 * 1024) break
      }
      if (encoded && encoded.type === 'image/jpeg' && encoded.size > 0 && encoded.size <= 700 * 1024) break
    }
  } finally { image.close() }
  if (!encoded || encoded.type !== 'image/jpeg' || !encoded.size || encoded.size > 700 * 1024) {
    throw new Error('Could not resize the selected photo. Choose a smaller image.')
  }
  const blob = encoded
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the selected photo.'))
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result.startsWith('data:image/jpeg;base64,')) {
        reject(new Error('Invalid photo. Choose a PNG or JPEG.'))
        return
      }
      resolve({ mime: 'image/jpeg', data: reader.result.split(',')[1] })
    }
    reader.readAsDataURL(blob)
  })
}

function excerpt(value: string, limit: number) {
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= limit) return text
  const shortened = text.slice(0, limit - 1).replace(/[\uD800-\uDBFF]$/, '').trimEnd()
  return `${shortened}…`
}

export function storyReelPrompt(story: ReelStory) {
  const scenes = story.scenes.slice(0, Math.max(0, story.currentStep + 1))
  const firstScene = scenes[0]?.body ? excerpt(scenes[0].body, 90) : 'Introduce the world and protagonist from the story context.'
  const latestScene = scenes.at(-1)?.body ? excerpt(scenes.at(-1)!.body, 90) : firstScene
  const recentChoices = story.responses.slice(0, Math.max(0, scenes.length - 1)).map(choice => excerpt(choice, 70)).filter(Boolean).slice(-2)
  const choiceSummary = recentChoices.length ? recentChoices.map((choice, index) => `${index + 1}. ${choice}`).join(' | ') : 'No explicit player choice yet; infer a single pivotal decision from the latest scene.'
  const prompt = [
    'Create a ~15-second vertical cinematic trailer in exactly three beats (5 seconds each).',
    'Keep the same protagonist and supporting cast consistent across all beats. Use a locked or gently moving camera.',
    'Use ambient sound and sound effects only. No music. No text, captions, logos, or presenter to camera.',
    'Do not show identifiable real people unless a provided protagonist photo explicitly authorizes one.',
    'Do not invent a completed ending. Show where the journey stands now.',
    `Story title: ${excerpt(story.title, 120)}`,
    `First scene excerpt: ${firstScene}`,
    `Most recent player choice(s): ${choiceSummary}`,
    `Latest scene excerpt: ${latestScene}`,
    `Beat 1 (0-5s): Opening and setting. Establish the protagonist in the story world using the title and first scene excerpt.`,
    `Beat 2 (5-10s): The pivotal player choice. Show the decision moment using the recent choice(s).`,
    `Beat 3 (10-15s): Consequence and current state. Show the immediate outcome and where the journey stands now, without finishing the story.`
  ].join('\n\n')
  return prompt.length <= 4000 ? prompt : `${excerpt(prompt, 3940)}\n\n[Some later story moments were omitted.]`
}

export default function HeygenStoryReel({ story, interfaceLanguage, canCreate }: { story: ReelStory; interfaceLanguage: StoryLanguageCode; canCreate: boolean }) {
  const italian = interfaceLanguage === 'it-IT'
  const [open, setOpen] = useState(false)
  const [duration, setDuration] = useState(15)
  const [prompt, setPrompt] = useState(() => storyReelPrompt(story))
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState('')
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null)
  const [viewed, setViewed] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [available, setAvailable] = useState<boolean | null>(null)
  const [referenceReservation, setReferenceReservation] = useState<number | null>(null)
  const [photoSlots, setPhotoSlots] = useState<(File | null)[]>([null, null, null])
  const [archiveEnabled, setArchiveEnabled] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const operation = useRef<AbortController | null>(null)
  const active = useRef(false)
  const clipUrl = useRef('')
  const photoInputs = useRef<(HTMLInputElement | null)[]>([])
  const storageKey = `muse-heygen-reel:${story.id}`
  const photoFiles = photoSlots.filter((photo): photo is File => photo !== null)
  function clearPhotos() {
    setPhotoSlots([null, null, null])
    for (const input of photoInputs.current) if (input) input.value = ''
  }

  useEffect(() => {
    setPrompt(storyReelPrompt(story))
    setConsent(false)
    clearPhotos()
  }, [story.id, story.currentStep])

  useEffect(() => {
    try { setToken(sessionStorage.getItem(storageKey) || '') }
    catch { setNotice('This browser cannot save the reel reference. Keep this tab open while it is generated.') }
    return () => {
      operation.current?.abort()
      if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
    }
  }, [storageKey])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void accountFetch('/api/heygen-reel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'availability' }), signal: controller.signal
    }).then(async response => {
      if (!response.ok) throw new Error('Could not check whether HeyGen is available.')
      const data: unknown = await response.json()
      if (!data || typeof data !== 'object' || !('available' in data) || typeof data.available !== 'boolean') throw new Error('Invalid reel availability response.')
      setAvailable(data.available)
      setArchiveEnabled('archive' in data && data.archive === true)
      const reservation = 'referenceReservation' in data && typeof data.referenceReservation === 'number'
        ? data.referenceReservation : null
      setReferenceReservation(reservation)
      if (reservation === null) {
        clearPhotos(); setConsent(false)
      }
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not check reel availability.')
    })
    return () => controller.abort()
  }, [open])

  async function request(action: string, fields: Record<string, unknown>, signal: AbortSignal) {
    const response = await accountFetch('/api/heygen-reel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...fields }), signal
    })
    if (!response.ok) {
      const data: unknown = await response.json().catch(() => null)
      const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Reel request failed.'
      throw new Error(message)
    }
    return response
  }

  async function loadVideo(reference: string, signal: AbortSignal) {
    const response = await request('video', { token: reference }, signal)
    const blob = await videoBlob(response, offset => request('video', { token: reference, offset }, signal),
      /^[0-9a-f-]{36}$/i.test(reference))
    if (!blob.size || !blob.type.startsWith('video/mp4')) throw new Error('The downloaded reel is not a valid MP4.')
    if (signal.aborted) return
    const url = URL.createObjectURL(blob)
    if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
    clipUrl.current = url
    setClip({ blob, url })
    setViewed(false)
    setNotice(italian ? 'Il reel è pronto. Guardalo prima di condividerlo.' : 'Your reel is ready. Watch it before sharing.')
  }

  async function waitForReel(reference: string, signal: AbortSignal) {
    for (let attempt = 0; attempt < 75; attempt++) {
      const response = await request('status', { token: reference }, signal)
      const result: unknown = await response.json()
      if (!result || typeof result !== 'object' || !('status' in result)) throw new Error('Invalid reel status.')
      if (result.status === 'completed') { await loadVideo(reference, signal); return }
      if (result.status === 'failed' || result.status === 'cancelled') throw new Error('HeyGen could not complete this reel. Check usage before creating another.')
      if (result.status !== 'pending' && result.status !== 'processing') throw new Error('Unknown reel status.')
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 4000)
        const abort = () => { window.clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
      })
    }
    setNotice('The reel is still being generated. Use Check status later; this will not create another video.')
  }

  async function run(reference?: string) {
    if (active.current || (!reference && (!canCreate || !story.journey || duration !== 15 || !consent || prompt.trim().length < 20))) return
    const controller = new AbortController()
    active.current = true
    operation.current = controller
    setBusy(true); setError(''); setNotice('')
    try {
      let reel = reference
      if (!reel) {
        const journey = story.journey
        if (!canCreate || !journey) throw new Error('Finish this chapter before creating a video.')
        const photos = await Promise.all(photoSlots.flatMap((photo, index) => photo
          ? [photoData(photo).then(data => ({ ...data, role: index === 0 ? 'protagonist' : 'element' }))]
          : []))
        if (controller.signal.aborted) return
        setUncertain(true)
        const submission = request('create', {
          id: crypto.randomUUID(), created: Date.now(), prompt: prompt.trim(),
          storyId: story.id, storyCapability: journey.capability,
          approved: true, consentVersion, ...(photos.length ? { photos, photoApproved: true } : {})
        }, controller.signal)
        clearPhotos()
        const response = await submission
        const data: unknown = await response.json()
        if (!data || typeof data !== 'object' || !('token' in data) || typeof data.token !== 'string') throw new Error('HeyGen did not confirm the reel reference. Check usage before retrying.')
        reel = data.token
        setToken(reel)
        setUncertain(false)
        try { sessionStorage.setItem(storageKey, reel) }
        catch { setNotice('The reel reference could not be saved in this browser. Keep this tab open.') }
      }
      await waitForReel(reel, controller.signal)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not create the reel.')
    } finally {
      if (operation.current === controller) operation.current = null
      active.current = false
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  const file = clip ? new File([clip.blob], 'muse-story-reel.mp4', { type: 'video/mp4' }) : null
  const download = () => {
    if (!clip || !viewed) return
    const link = document.createElement('a')
    link.href = clip.url; link.download = 'muse-story-reel.mp4'
    document.body.append(link); link.click(); link.remove()
  }
  const share = async () => {
    if (!file || !viewed) return
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      setError(italian ? 'Scarica il video e caricalo nella tua app social.' : 'Download the video and upload it in your social app.')
      return
    }
    try { await navigator.share({ title: story.title, files: [file] }) }
    catch (cause) { if (!(cause instanceof Error && cause.name === 'AbortError')) setError('Could not share the reel. Download it instead.') }
  }
  const startAnother = () => {
    if (busy) return
    try { sessionStorage.removeItem(storageKey) }
    catch { setError('Could not remove the saved reel reference from this browser.'); return }
    if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
    clipUrl.current = ''
    setToken(''); setClip(null); setViewed(false); setConsent(false); clearPhotos(); setUncertain(false); setError(''); setNotice('')
  }
  if (!canCreate && !token) return null
  return <section className="story-reel">
    <button type="button" className="atelier-secondary" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {canCreate ? (italian ? 'Crea video' : 'Create video') : (italian ? 'Controlla video esistente' : 'Check existing video')}
    </button>
    {open ? <div className="story-reel-panel">
      <h3>{italian ? 'Video verticale della tua storia' : 'Your vertical story video'}</h3>
      {duration === 15 ? <p>{italian ? 'HeyGen crea una breve scena video in tre parti ispirata ai momenti e alle scelte salvate qui sotto. Non è un film completo e i personaggi potrebbero non essere rappresentati fedelmente. Nulla viene pubblicato automaticamente.' :
        'HeyGen creates one short three-part video scene inspired by the saved moments and choices below. It is not a full movie, and characters may not be depicted faithfully. Nothing is posted automatically.'}</p> : null}
      {available === false ? <p role="status">{italian ? 'HeyGen non è ancora configurato o approvato dall’operatore.' : 'HeyGen is not configured or approved by the operator yet.'}</p> : null}
      {!token ? <>
        <label>{italian ? 'Modello video' : 'Video model'}
          <select defaultValue="heygen-video-1" onChange={() => setConsent(false)}>
            <option value="heygen-video-1">HeyGen Video 1 · 768p</option>
            <option value="video-agent" disabled>{italian ? 'HeyGen Video Agent · previsto, non disponibile' : 'HeyGen Video Agent · planned, unavailable'}</option>
          </select>
        </label>
        <label>{italian ? 'Durata del video' : 'Video duration'}
          <select value={duration} onChange={event => {
            setDuration(Number(event.target.value))
            setConsent(false)
          }}>
            <option value={15}>{italian ? '15 secondi' : '15 seconds'}</option>
            <option value={30}>{italian ? '30 secondi' : '30 seconds'}</option>
            <option value={60}>{italian ? '1 minuto' : '1 minute'}</option>
            <option value={120}>{italian ? '2 minuti' : '2 minutes'}</option>
            <option value={180}>{italian ? '3 minuti' : '3 minutes'}</option>
          </select>
        </label>
        {duration !== 15 ? <p role="status">{italian
          ? 'I video più lunghi non sono ancora disponibili. È necessaria una nuova integrazione HeyGen e la verifica dei costi.'
          : 'Longer videos are not available yet. They need a different HeyGen integration and a cost review.'}</p> : null}
        <label>{italian ? 'Testo inviato a HeyGen' : 'Text sent to HeyGen'}
          <textarea rows={10} maxLength={4000} value={prompt} onChange={event => { setPrompt(event.target.value); setConsent(false) }} />
        </label>
        <p>{italian ? 'Il testo include estratti della storia e delle tue scelte. Controlla e rimuovi dettagli privati prima di inviarlo.' : 'This includes excerpts from your story and choices. Review and remove private details before sending it.'}</p>
        {archiveEnabled ? <p>{italian ? 'Il video sarà disponibile nel tuo archivio privato per 7 giorni, dopo il completamento.' :
          'The video will be available in your private archive for 7 days after completion.'}</p> : null}
        {referenceReservation ? <>
          <p>{italian ? 'Foto di riferimento facoltative: PNG/JPEG, fino a 20 MB ciascuna.' :
            'Optional reference photos: PNG/JPEG, up to 20 MB each.'}</p>
          {[italian ? 'Protagonista' : 'Protagonist', italian ? 'Elemento 1' : 'Element 1', italian ? 'Elemento 2' : 'Element 2'].map((label, index) =>
            <label key={index}>{label}
              <input ref={element => { photoInputs.current[index] = element }} type="file" accept="image/png,image/jpeg" disabled={busy}
                onChange={event => {
                  const photo = event.target.files?.[0] ?? null
                  setConsent(false)
                  if (photo && (!['image/png', 'image/jpeg'].includes(photo.type) || photo.size > 20 * 1024 * 1024 || !photo.size)) {
                    setPhotoSlots(current => current.map((item, slot) => slot === index ? null : item))
                    event.target.value = ''
                    setError(italian ? 'Scegli una foto PNG/JPEG di massimo 20 MB.' : 'Choose a PNG/JPEG photo of at most 20 MB.')
                    return
                  }
                  setError('')
                  setPhotoSlots(current => current.map((item, slot) => slot === index ? photo : item))
                }} />
            </label>)}
          <p>{italian
            ? 'Le foto vengono ridimensionate nel browser e inviate a HeyGen solo per creare il video; Muse non le salva. HeyGen crea URL pubblici: chi li conosce potrebbe vedere le foto. Cerchiamo di eliminare le copie dopo la generazione; errori possono richiedere un intervento manuale. Usa solo foto per cui hai il permesso delle persone ritratte.'
            : 'Photos are resized in your browser and sent to HeyGen only to create the video; Muse does not save them. HeyGen creates public URLs: anyone with a URL may see the photo. We attempt to delete provider copies after generation; failures may require manual intervention. Only use photos you have permission to share, including permission from people pictured.'}</p>
        </> : null}
        {duration === 15 && photoFiles.length > 0 && referenceReservation !== null ? <p>{italian
          ? `La prenotazione stimata è $${(referenceReservation / 100).toFixed(2)}; tasse escluse. Il costo effettivo può variare.`
          : `The estimated reservation is $${(referenceReservation / 100).toFixed(2)}, excluding tax; actual charges may vary.`}</p>
          : duration === 15 ? <p>{italian ? 'Questo richiede una generazione a pagamento. La stima conservativa è $0,54; tasse escluse. Il costo effettivo può variare.' :
          'This starts paid generation. The conservative reservation is $0.54, excluding tax; actual charges may vary.'}</p> : null}
        <label><input type="checkbox" checked={consent} disabled={duration !== 15} onChange={event => setConsent(event.target.checked)} />
          {italian ? 'Accetto di inviare questo testo e le eventuali foto selezionate a HeyGen e avviare la generazione a pagamento.' :
            'I agree to send this text and any selected photos to HeyGen and start paid generation.'}</label>
        <button type="button" className="atelier-button" disabled={duration !== 15 || !available || busy || uncertain || !consent || prompt.trim().length < 20}
          onClick={() => void run()}>{busy ? (italian ? 'Creazione del video…' : 'Creating video…') : italian ? 'Genera video' : 'Generate video'}</button>
      </> : !clip ? <button type="button" disabled={busy} onClick={() => void run(token)}>{italian ? 'Controlla stato' : 'Check status'}</button> : null}
      {busy ? <p role="status">{italian ? 'Creazione del reel. Può richiedere qualche minuto.' : 'Creating your reel. This can take a few minutes.'}</p> : null}
      {clip ? <section className="story-reel-preview">
        <video className="share-studio-video" src={clip.url} controls playsInline onPlay={() => setViewed(true)} aria-label="Story reel preview" />
        <div className="atelier-actions">
          <button type="button" disabled={!viewed} onClick={download}>{italian ? 'Scarica MP4' : 'Download MP4'}</button>
          <button type="button" disabled={!viewed} onClick={() => void share()}>{italian ? 'Condividi reel' : 'Share reel'}</button>
        </div>
      </section> : null}
      {canCreate && token && !busy ? <button type="button" onClick={startAnother}>{italian ? 'Prepara un altro reel' : 'Prepare another reel'}</button> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {uncertain && !token && !busy ? <p>Submission may have been charged. Check HeyGen usage before starting another reel; no automatic retry was made.</p> : null}
    </div> : null}
  </section>
}

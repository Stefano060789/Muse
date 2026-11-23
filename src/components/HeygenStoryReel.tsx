import { useEffect, useRef, useState } from 'react'
import { accountFetch } from '../lib/accountClient'
import type { PersonalStory } from '../lib/story'
import type { StoryLanguageCode } from '../lib/storyLanguage'

type ReelStory = Pick<PersonalStory, 'id' | 'title' | 'scenes' | 'responses' | 'currentStep'>
const consentVersion = 'heygen-reel-2026-11'

function excerpt(value: string, limit: number) {
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= limit) return text
  const shortened = text.slice(0, limit - 1).replace(/[\uD800-\uDBFF]$/, '').trimEnd()
  return `${shortened}…`
}

export function storyReelPrompt(story: ReelStory) {
  const scenes = story.scenes.slice(0, Math.max(0, story.currentStep + 1))
  const moments = scenes.map((scene, index) => {
    const action = index > 0 && story.responses[index - 1]
      ? `Player's choice: ${excerpt(story.responses[index - 1], 90)}\n` : ''
    return `${action}Story moment ${index + 1}: ${excerpt(scene.body, 120)}`
  })
  const prompt = [
    'Create a short, vertical cinematic story trailer, not an animated card or a presenter speaking to camera.',
    'Use the story moments and player choices below to depict the actual characters, setting and consequences. Do not invent a completed ending.',
    'Choose one clear, visually compelling action that captures the journey so far. Use a consistent cast, natural movement and atmospheric sound; no text, captions or logos.',
    `Story: ${excerpt(story.title, 160)}`,
    ...moments
  ].join('\n\n')
  return prompt.length <= 4000 ? prompt : `${excerpt(prompt, 3940)}\n\n[Some later story moments were omitted.]`
}

export default function HeygenStoryReel({ story, interfaceLanguage }: { story: ReelStory; interfaceLanguage: StoryLanguageCode }) {
  const italian = interfaceLanguage === 'it-IT'
  const [open, setOpen] = useState(false)
  const [duration, setDuration] = useState(10)
  const [prompt, setPrompt] = useState(() => storyReelPrompt(story))
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState('')
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null)
  const [viewed, setViewed] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [available, setAvailable] = useState<boolean | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const operation = useRef<AbortController | null>(null)
  const active = useRef(false)
  const clipUrl = useRef('')
  const storageKey = `muse-heygen-reel:${story.id}`

  useEffect(() => {
    setPrompt(storyReelPrompt(story))
    setConsent(false)
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
    const blob = await response.blob()
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
    if (active.current || (!reference && (duration !== 10 || !consent || prompt.trim().length < 20))) return
    const controller = new AbortController()
    active.current = true
    operation.current = controller
    setBusy(true); setError(''); setNotice('')
    try {
      let reel = reference
      if (!reel) {
        setUncertain(true)
        const response = await request('create', {
          id: crypto.randomUUID(), created: Date.now(), prompt: prompt.trim(),
          approved: true, consentVersion
        }, controller.signal)
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
    setToken(''); setClip(null); setViewed(false); setConsent(false); setUncertain(false); setError(''); setNotice('')
  }
  return <section className="story-reel">
    <button type="button" className="atelier-button" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {italian ? 'Crea video' : 'Create video'}
    </button>
    {open ? <div className="story-reel-panel">
      <h3>{italian ? 'Video verticale della tua storia' : 'Your vertical story video'}</h3>
      {duration === 10 ? <p>{italian ? 'HeyGen crea una scena video ispirata ai momenti e alle scelte salvate qui sotto. Non è un film completo e i personaggi potrebbero non essere rappresentati fedelmente. Nulla viene pubblicato automaticamente.' :
        'HeyGen creates one video scene inspired by the saved moments and choices below. It is not a full movie, and characters may not be depicted faithfully. Nothing is posted automatically.'}</p> : null}
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
            <option value={10}>{italian ? '10 secondi' : '10 seconds'}</option>
            <option value={30}>{italian ? '30 secondi' : '30 seconds'}</option>
            <option value={60}>{italian ? '1 minuto' : '1 minute'}</option>
            <option value={120}>{italian ? '2 minuti' : '2 minutes'}</option>
            <option value={180}>{italian ? '3 minuti' : '3 minutes'}</option>
          </select>
        </label>
        {duration !== 10 ? <p role="status">{italian
          ? 'I video più lunghi non sono ancora disponibili. È necessaria una nuova integrazione HeyGen e la verifica dei costi.'
          : 'Longer videos are not available yet. They need a different HeyGen integration and a cost review.'}</p> : null}
        <label>{italian ? 'Testo inviato a HeyGen' : 'Text sent to HeyGen'}
          <textarea rows={10} maxLength={4000} value={prompt} onChange={event => { setPrompt(event.target.value); setConsent(false) }} />
        </label>
        <p>{italian ? 'Il testo include estratti della storia e delle tue scelte. Controlla e rimuovi dettagli privati prima di inviarlo.' : 'This includes excerpts from your story and choices. Review and remove private details before sending it.'}</p>
        {duration === 10 ? <p>{italian ? 'Questo richiede una generazione a pagamento. La stima conservativa è $0,36; tasse escluse.' :
          'This starts paid generation. The conservative reservation is $0.36, excluding tax; actual provider prices may change.'}</p> : null}
        <label><input type="checkbox" checked={consent} disabled={duration !== 10} onChange={event => setConsent(event.target.checked)} />
          {italian ? 'Accetto di inviare questo testo a HeyGen e avviare la generazione a pagamento.' :
            'I agree to send this text to HeyGen and start paid generation.'}</label>
        <button type="button" className="atelier-button" disabled={duration !== 10 || !available || busy || uncertain || !consent || prompt.trim().length < 20}
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
      {token && !busy ? <button type="button" onClick={startAnother}>{italian ? 'Prepara un altro reel' : 'Prepare another reel'}</button> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {uncertain && !token && !busy ? <p>Submission may have been charged. Check HeyGen usage before starting another reel; no automatic retry was made.</p> : null}
    </div> : null}
  </section>
}

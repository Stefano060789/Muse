import { useEffect, useRef, useState } from 'react'
import { accountFetch } from '../lib/accountClient'
import type { PersonalStory } from '../lib/story'
import type { StoryLanguageCode } from '../lib/storyLanguage'

type ReelStory = Pick<PersonalStory, 'id' | 'title' | 'scenes' | 'currentStep'>
const consentVersion = 'heygen-reel-2026-11'

export default function HeygenStoryReel({ story, interfaceLanguage }: { story: ReelStory; interfaceLanguage: StoryLanguageCode }) {
  const italian = interfaceLanguage === 'it-IT'
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState(() => `${story.title}. ${story.scenes[0]?.body || ''}`.replace(/\s+/g, ' ').slice(0, 650))
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
    if (active.current || (!reference && (!consent || prompt.trim().length < 20))) return
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
      {italian ? 'Crea il mio reel' : 'Create my story reel'}
    </button>
    {open ? <div className="story-reel-panel">
      <h3>{italian ? 'Un video verticale di 10 secondi' : 'A 10-second vertical video'}</h3>
      <p>{italian ? 'HeyGen crea un video MP4 dal testo qui sotto. Nessun contenuto viene pubblicato automaticamente.' :
        'HeyGen creates an MP4 from the text below. Nothing is posted automatically.'}</p>
      {available === false ? <p role="status">{italian ? 'HeyGen non è ancora configurato o approvato dall’operatore.' : 'HeyGen is not configured or approved by the operator yet.'}</p> : null}
      {!token ? <>
        <label>{italian ? 'Testo inviato a HeyGen' : 'Text sent to HeyGen'}
          <textarea rows={4} maxLength={700} value={prompt} onChange={event => { setPrompt(event.target.value); setConsent(false) }} />
        </label>
        <p>{italian ? 'Controlla e rimuovi dettagli privati prima di continuare.' : 'Review and remove any private details before continuing.'}</p>
        <p>{italian ? 'Questo richiede una generazione a pagamento. La stima conservativa è $0,36; tasse escluse.' :
          'This starts paid generation. The conservative reservation is $0.36, excluding tax; actual provider prices may change.'}</p>
        <label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
          {italian ? 'Accetto di inviare questo testo a HeyGen e avviare la generazione a pagamento.' :
            'I agree to send this text to HeyGen and start paid generation.'}</label>
        <button type="button" className="atelier-button" disabled={!available || busy || uncertain || !consent || prompt.trim().length < 20}
          onClick={() => void run()}>{busy ? (italian ? 'Creazione del reel…' : 'Creating reel…') : italian ? 'Crea video' : 'Create video'}</button>
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

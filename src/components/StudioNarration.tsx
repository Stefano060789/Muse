import { useEffect, useRef, useState, type RefObject } from 'react'

export type StudioSceneStatus = { enabled: boolean; ready: boolean; blocked?: boolean; message?: string }

type Props = {
  sceneIndex: number
  owner?: boolean
  disabled?: boolean
  stopSignal?: boolean
  audioRef: RefObject<HTMLAudioElement>
  beforeListen: () => void
  check?: (sceneIndex: number, signal: AbortSignal) => Promise<StudioSceneStatus>
  generate?: (sceneIndex: number, signal: AbortSignal) => Promise<StudioSceneStatus>
  load: (sceneIndex: number, signal: AbortSignal) => Promise<Blob>
  provider?: 'google' | 'elevenlabs'
}

export default function StudioNarration({ sceneIndex, owner = false, disabled = false, stopSignal, audioRef, beforeListen, check, generate, load,
  provider = process.env.NEXT_PUBLIC_NARRATION_PROVIDER === 'google' ? 'google' : 'elevenlabs' }: Props) {
  const [status, setStatus] = useState<StudioSceneStatus | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [url, setUrl] = useState('')
  const pending = useRef<AbortController | null>(null)
  const blobUrl = useRef('')
  const generation = useRef(0)
  useEffect(() => () => {
    generation.current++
    pending.current?.abort()
    audioRef.current?.pause()
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current)
  }, [audioRef])
  useEffect(() => {
    if (stopSignal || disabled) audioRef.current?.pause()
  }, [stopSignal, disabled, audioRef])

  const run = async (action: 'check' | 'generate' | 'load') => {
    if (pending.current || busy || disabled || (action === 'generate' && !consent)) return
    const current = ++generation.current
    const controller = new AbortController()
    pending.current?.abort()
    pending.current = controller
    setBusy(true); setError('')
    try {
      if (action === 'check' && check) {
        const result = await check(sceneIndex, controller.signal)
        if (current === generation.current) setStatus(result)
      } else if (action === 'generate' && generate) {
        const result = await generate(sceneIndex, controller.signal)
        if (current === generation.current) { setStatus(result); setConsent(false) }
      } else if (action === 'load') {
        beforeListen()
        const blob = await load(sceneIndex, controller.signal)
        if (current !== generation.current) return
        if (!blob.size || !blob.type.startsWith('audio/')) throw new Error('Studio returned an invalid audio file.')
        audioRef.current?.pause()
        if (blobUrl.current) URL.revokeObjectURL(blobUrl.current)
        blobUrl.current = URL.createObjectURL(blob)
        setUrl(blobUrl.current)
      }
    } catch (cause) {
      if (current === generation.current && !controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Studio audio could not be loaded.')
        if (action === 'generate') { setStatus(null); setConsent(false) }
      }
    } finally {
      if (current === generation.current) { setBusy(false); pending.current = null }
    }
  }

  const content = <>
    {provider === 'google' ? <h2>Listen to this scene</h2> : null}
    <p>{provider === 'google' ? 'AI-generated narration by Google WaveNet. Play the saved recording on iPhone or desktop; no device speech is used.' : 'A prepared recording, separate from the free device voice. No autoplay and no automatic switch to device speech.'}</p>
    {owner ? <>
      <p>Optional {provider === 'google' ? 'Google Cloud' : 'ElevenLabs'} narration of this prepared scene and clue only, not the private answer or final reveal. Each uncached generation uses the operator&apos;s paid budget; replay reuses the recording. Live AI turns are not included.</p>
      <button type="button" disabled={busy || disabled} onClick={() => void run('check')}>Check Studio availability</button>
      {status ? <p role="status">{status.message || (status.ready ? 'This scene has a prepared recording.' : status.enabled ? 'Studio is configured. This scene has no recording yet.' : 'Studio generation is disabled until credentials and a budget are configured.')}</p> : null}
      {status?.enabled && !status.ready && !status.blocked ? <>
        <label style={{ display: 'block', margin: '1rem 0' }}><input type="checkbox" checked={consent} disabled={busy || disabled} onChange={event => setConsent(event.target.checked)} /> Send this scene and clue to {provider === 'google' ? 'Google Cloud' : 'ElevenLabs'} and use a paid generation attempt. <a href="/privacy">Privacy</a></label>
        <button type="button" disabled={busy || disabled || !consent} onClick={() => void run('generate')}>Prepare this scene&apos;s Studio audio</button>
      </> : null}
    </> : <p>Load the sender&apos;s saved recording. Listening never generates paid audio. If it was not prepared, ask the sender to add narration or keep reading.</p>}
    {!owner || status?.ready ? <button type="button" disabled={busy || disabled} onClick={() => void run('load')}>{provider === 'google' ? 'Load scene recording' : 'Load Studio audio'}</button> : null}
    {busy ? <p role="status">Working on Studio audio...</p> : null}
    {error ? <p role="alert">{error} Read instead, retry, or explicitly choose the device voice controls.</p> : null}
    {url ? <>
      <p>Ready. Tap Play in the audio player below, including on iPhone.</p>
      <audio ref={audioRef} src={url} controls preload="metadata" aria-label={`Studio audio for scene ${sceneIndex + 1}`} onPlay={() => {
        if (disabled) { audioRef.current?.pause(); setError('Finish the current story request, upload or recording before playing Studio audio.'); return }
        beforeListen()
      }} onError={() => setError('This browser could not play Studio audio. Retry loading or read instead.')} style={{ display: 'block', width: '100%', maxWidth: '100%' }} />
    </> : null}
  </>
  if (provider === 'google') return <section aria-label="Studio narration" className="atelier-card" style={{ margin: '1rem 0' }}>{content}</section>
  return <details aria-label="Studio narration" style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #d8cdd6', borderRadius: 16, maxWidth: '100%', minWidth: 0 }}>
    <summary>Studio audio · {owner ? 'optional' : 'if prepared'}</summary>
    {content}
  </details>
}

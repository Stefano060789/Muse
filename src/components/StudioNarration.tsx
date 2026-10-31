import { useEffect, useRef, useState, type RefObject } from 'react'
import { useAccountPermissions } from '../lib/useAccountPermissions'
import ExplicitConsent from './ExplicitConsent'

export type StudioSceneStatus = { enabled: boolean; ready: boolean; blocked?: boolean; message?: string }

type Props = {
  sceneIndex: number
  owner?: boolean
  disabled?: boolean
  stopSignal?: boolean
  audioRef: RefObject<HTMLAudioElement>
  beforeListen: () => void
  ambientText?: string
  onAmbientStart?: (text: string) => void
  onAmbientPause?: () => void
  onAmbientStop?: () => void
  onReadAlong?: (position: number, active: boolean) => void
  voiceVolume?: number
  check?: (sceneIndex: number, signal: AbortSignal) => Promise<StudioSceneStatus>
  generate?: (sceneIndex: number, signal: AbortSignal) => Promise<StudioSceneStatus>
  load: (sceneIndex: number, signal: AbortSignal) => Promise<Blob>
  provider?: 'google' | 'elevenlabs'
  playRequest?: number
}

export default function StudioNarration({ sceneIndex, owner = false, disabled = false, stopSignal, audioRef, beforeListen, check, generate, load,
  ambientText = '', onAmbientStart, onAmbientPause, onAmbientStop, onReadAlong, voiceVolume = 0.9, playRequest = 0,
  provider = process.env.NEXT_PUBLIC_NARRATION_PROVIDER === 'google' ? 'google' : 'elevenlabs' }: Props) {
  const [status, setStatus] = useState<StudioSceneStatus | null>(null)
  const permissions = useAccountPermissions()
  const [localConsent, setConsent] = useState(false)
  const consent = permissions.managed ? permissions.services : localConsent
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [url, setUrl] = useState('')
  const pending = useRef<AbortController | null>(null)
  const blobUrl = useRef('')
  const generation = useRef(0)
  const playWhenLoaded = useRef(false)
  const ambientCallbacks = useRef({ onAmbientStart, onAmbientPause, onAmbientStop, onReadAlong })
  ambientCallbacks.current = { onAmbientStart, onAmbientPause, onAmbientStop, onReadAlong }
  useEffect(() => () => {
    generation.current++
    pending.current?.abort()
    audioRef.current?.pause()
    ambientCallbacks.current.onAmbientStop?.()
    ambientCallbacks.current.onReadAlong?.(0, false)
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current)
  }, [audioRef])
  useEffect(() => {
    if (stopSignal || disabled) audioRef.current?.pause()
  }, [stopSignal, disabled, audioRef])
  useEffect(() => {
    setConsent(false)
    if (!pending.current && !blobUrl.current) return
    generation.current++
    pending.current?.abort()
    pending.current = null
    playWhenLoaded.current = false
    audioRef.current?.pause()
    ambientCallbacks.current.onAmbientStop?.()
    ambientCallbacks.current.onReadAlong?.(0, false)
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current)
    blobUrl.current = ''
    setUrl('')
    setBusy(false)
  }, [permissions.accountId, permissions.managed, permissions.services, permissions.error, audioRef])
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = voiceVolume
  }, [voiceVolume, url, audioRef])
  useEffect(() => {
    if (!url || !playWhenLoaded.current || disabled || stopSignal) return
    playWhenLoaded.current = false
    const player = audioRef.current
    const current = generation.current
    if (player) void player.play().catch(() => {
      if (current === generation.current) setError('Playback could not start automatically. Press Play to listen, or choose Read.')
    })
  }, [url, disabled, stopSignal, audioRef])

  const run = async (action: 'check' | 'generate' | 'load', play = false) => {
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
        if (play && owner && check) {
          const available = await check(sceneIndex, controller.signal)
          if (current !== generation.current) return
          setStatus(available)
          if (!available.ready) throw new Error('This scene has no prepared recording. Prepare one below or explicitly choose the device voice.')
        }
        const blob = await load(sceneIndex, controller.signal)
        if (current !== generation.current) return
        if (!blob.size || !blob.type.startsWith('audio/')) throw new Error('Studio returned an invalid audio file.')
        audioRef.current?.pause()
        if (blobUrl.current) URL.revokeObjectURL(blobUrl.current)
        blobUrl.current = URL.createObjectURL(blob)
        playWhenLoaded.current = play
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

  const runRef = useRef(run)
  runRef.current = run
  useEffect(() => {
    if (playRequest > 0) void runRef.current('load', true)
  }, [playRequest])

  const content = <>
    {owner ? <p>{provider === 'google' ? 'Google WaveNet recording' : 'Studio voice recording'} · Listen plays saved audio; it never generates a paid recording automatically.</p> : null}
    {owner ? <>
      <details><summary>Recording privacy and cost</summary><p>Optional {provider === 'google' ? 'Google Cloud' : 'ElevenLabs'} narration of this scene and clue, excluding the private answer and reveal. New recordings use the paid narration allowance; replay reuses them. Live AI turns are not included.</p></details>
      <button type="button" disabled={busy || disabled} onClick={() => void run('check')}>Check Studio availability</button>
      {status ? <p role="status">{status.message || (status.ready ? 'This scene has a prepared recording.' : status.enabled ? 'Studio is configured. This scene has no recording yet.' : 'Studio generation is disabled until credentials and a budget are configured.')}</p> : null}
      {status?.enabled && !status.ready && !status.blocked ? <>
        <ExplicitConsent checked={consent} onChange={setConsent}>Send this scene and clue to {provider === 'google' ? 'Google Cloud' : 'ElevenLabs'} and use a paid generation attempt. <a href="/privacy">Privacy</a></ExplicitConsent>
        <button type="button" disabled={busy || disabled || !consent} onClick={() => void run('generate')}>Prepare this scene&apos;s Studio audio</button>
      </> : null}
    </> : null}
    {!owner || status?.ready ? <button type="button" disabled={busy || disabled} onClick={() => void run('load')}>{provider === 'google' ? 'Load scene recording' : 'Load Studio audio'}</button> : null}
    {busy ? <p role="status">Working on Studio audio...</p> : null}
    {error ? <p role="alert">{error} Read instead, retry, or explicitly choose the device voice controls.</p> : null}
    {url ? <>
      <audio ref={audioRef} src={url} controls preload="metadata" aria-label={`Studio audio for scene ${sceneIndex + 1}`} onPlay={() => {
        if (disabled) { audioRef.current?.pause(); setError('Finish the current story request, upload or recording before playing Studio audio.'); return }
        beforeListen()
        ambientCallbacks.current.onAmbientStart?.(ambientText)
        ambientCallbacks.current.onReadAlong?.(Math.floor(ambientText.length * (audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0 ? audioRef.current.currentTime / audioRef.current.duration : 0)), true)
      }} onPause={() => ambientCallbacks.current.onAmbientPause?.()}
        onTimeUpdate={event => {
          const player = event.currentTarget
          if (Number.isFinite(player.duration) && player.duration > 0) ambientCallbacks.current.onReadAlong?.(Math.floor(ambientText.length * Math.min(1, Math.max(0, player.currentTime / player.duration))), true)
        }}
        onEnded={() => { ambientCallbacks.current.onAmbientStop?.(); ambientCallbacks.current.onReadAlong?.(ambientText.length, false) }}
        onError={() => { ambientCallbacks.current.onAmbientStop?.(); ambientCallbacks.current.onReadAlong?.(0, false); setError('This browser could not play Studio audio. Retry loading or read instead.') }}
        style={{ display: 'block', width: '100%', maxWidth: '100%' }} />
    </> : null}
  </>
  if (!owner) return <section aria-label="Studio narration" style={{ margin: '1rem 0', maxWidth: '100%', minWidth: 0 }}>
    {content}
    <details><summary>About this recording</summary><p>{provider === 'google' ? 'AI-generated narration by Google WaveNet.' : 'AI-generated Studio narration.'} This plays the sender&apos;s saved recording and never generates paid audio. If unavailable, keep reading or ask the sender to prepare it. Listen starts playback; if your browser blocks it, press Play. It never switches to a device voice automatically.</p><p>Simple text cues select synthetic local ambience for explicit playback. Recording text follows elapsed audio time; word timing is approximate.</p></details>
  </section>
  return <section aria-label="Studio narration" style={{ margin: '1rem 0', maxWidth: '100%', minWidth: 0 }}>{content}</section>
}

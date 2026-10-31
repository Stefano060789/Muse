import { useEffect, useRef, useState } from 'react'
import { VOICE_MAX_BYTES, VOICE_SAMPLE_RATE, VOICE_SECONDS, wavRecording } from '../lib/voiceRecording'
import { useAccountPermissions } from '../lib/useAccountPermissions'
import { useInterfaceLanguage } from '../lib/interfaceLanguage'
import { registrationCopy } from '../lib/registrationCopy'

export default function GiftVoiceRecorder({ file, onChange, disabled, beforeRecord, onActiveChange }: {
  file: File | null
  onChange: (file: File | null) => void
  disabled: boolean
  beforeRecord: () => void
  onActiveChange: (active: boolean) => void
}) {
  const permissions = useAccountPermissions()
  const language = useInterfaceLanguage()
  const [localConsent, setConsent] = useState(false)
  const consent = permissions.managed ? permissions.services : localConsent
  const [recording, setRecording] = useState(false)
  const [starting, setStarting] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')
  const stopRef = useRef<(() => void) | null>(null)
  const previewAudio = useRef<HTMLAudioElement>(null)
  const generation = useRef(0)

  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => () => { generation.current++; stopRef.current?.() }, [])
  useEffect(() => { onActiveChange(recording || starting) }, [recording, starting, onActiveChange])
  useEffect(() => {
    generation.current++
    stopRef.current?.()
    setStarting(false)
    setRecording(false)
    setConsent(false)
    if (permissions.managed && !permissions.services) onChange(null)
  }, [permissions.accountId, permissions.managed, permissions.services, permissions.error])

  const start = async () => {
    if (!consent || disabled || starting || recording) return
    if (!permissions.ready || permissions.error) {
      setError(permissions.error || 'Account permissions are still loading. Try again shortly.')
      return
    }
    setError(''); setStarting(true)
    const attempt = ++generation.current
    let stream: MediaStream | null = null
    let context: AudioContext | null = null
    try {
      previewAudio.current?.pause()
      beforeRecord()
      if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') throw new Error('Recording is unavailable here. Upload a WAV recording or use your device browser over HTTPS.')
      context = new AudioContext({ sampleRate: VOICE_SAMPLE_RATE })
      await context.resume()
      if (!context.audioWorklet || typeof AudioWorkletNode === 'undefined') throw new Error('Recording is unavailable in this browser. Upload a WAV file instead.')
      await context.audioWorklet.addModule('/gift-recorder-worklet.js')
      if (attempt !== generation.current) { await context.close(); return }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (attempt !== generation.current) {
        stream.getTracks().forEach(track => track.stop())
        await context.close()
        return
      }
      const source = context.createMediaStreamSource(stream)
      const processor = new AudioWorkletNode(context, 'muse-gift-recorder', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' })
      const silent = context.createGain()
      silent.gain.value = 0
      const chunks: number[] = []
      let consumed = 0
      let nextSample = 0
      let stopped = false
      let timer: ReturnType<typeof setTimeout> | undefined
      const activeContext = context
      const activeStream = stream
      const cleanup = () => {
        if (stopped) return
        stopped = true
        if (timer) clearTimeout(timer)
        processor.port.onmessage = null
        processor.port.close()
        source.disconnect(); processor.disconnect(); silent.disconnect()
        activeStream.getTracks().forEach(track => { track.onended = null; track.stop() })
        void activeContext.close().catch(() => setError('The audio session could not be closed. Close this page if the microphone indicator remains on.'))
        stopRef.current = null
      }
      const finish = () => {
        cleanup()
        if (attempt !== generation.current) return
        setRecording(false)
        try {
          const data = wavRecording(Float32Array.from(chunks))
          onChange(new File([data], 'personal-message.wav', { type: 'audio/wav' }))
        } catch (error) { setError(error instanceof Error ? error.message : 'Could not save this recording. Please try again.') }
      }
      stopRef.current = finish
      activeStream.getAudioTracks().forEach(track => { track.onended = finish })
      timer = setTimeout(finish, VOICE_SECONDS * 1000)
      processor.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (stopped) return
        const input = event.data
        const ratio = activeContext.sampleRate / VOICE_SAMPLE_RATE
        while (nextSample < consumed + input.length && chunks.length < VOICE_SAMPLE_RATE * VOICE_SECONDS) {
          chunks.push(input[Math.max(0, Math.floor(nextSample - consumed))])
          nextSample += ratio
        }
        consumed += input.length
        setSeconds(Math.floor(chunks.length / VOICE_SAMPLE_RATE))
        if (chunks.length >= VOICE_SAMPLE_RATE * VOICE_SECONDS) finish()
      }
      source.connect(processor); processor.connect(silent); silent.connect(context.destination)
      setSeconds(0); setRecording(true)
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop())
      if (context && context.state !== 'closed') void context.close().catch(() => setError('Could not close the audio session. Close this page if the microphone indicator remains on.'))
      if (attempt === generation.current) setError(error instanceof Error && error.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow it in your browser settings, or upload a WAV recording instead.'
        : error instanceof Error ? error.message : 'Could not access the microphone. Check permission or upload a WAV file.')
    } finally { if (attempt === generation.current) setStarting(false) }
  }
  return <section aria-label="Personal voice message">
    <p>Add your own voice to the final reveal. Up to 60 seconds, 5 MB. No cloning, transcription or AI processing.</p>
    {!permissions.managed ? <label style={{ display: 'block', marginBottom: 12 }}><input type="checkbox" checked={consent} disabled={recording || starting || disabled} onChange={event => { setConsent(event.target.checked); if (!event.target.checked) onChange(null) }} /> I choose to record or upload my voice for the recipient. It will be stored privately with this story until removed or the story is deleted, with no automatic expiry.</label> : !consent ? <p role="alert"><a href="/account">{registrationCopy(language).settings}</a></p> : null}
    {error ? <p role="alert">{error}</p> : null}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {recording ? <button type="button" onClick={() => stopRef.current?.()} style={{ minHeight: 44, padding: '0.8rem' }}>Stop recording ({seconds}s / 60s)</button> : <button type="button" disabled={!consent || disabled || starting} onClick={() => void start()} style={{ minHeight: 44, padding: '0.8rem' }}>{starting ? 'Opening microphone...' : 'Record a message'}</button>}
      {starting ? <button type="button" onClick={() => { generation.current++; setStarting(false) }} style={{ minHeight: 44 }}>Cancel</button> : null}
    </div>
    <label style={{ display: 'block', marginTop: 12 }}>Or upload a WAV recording
      <input type="file" accept=".wav,audio/wav,audio/x-wav" disabled={!consent || disabled || recording || starting} style={{ display: 'block', width: '100%', marginTop: 8 }} onChange={event => {
        const selected = event.target.files?.[0]
        event.target.value = ''
        if (!selected) return
        if (!/\.wav$/i.test(selected.name) || selected.size > VOICE_MAX_BYTES || !selected.size) { setError('Choose a WAV recording up to 60 seconds and 5 MB.'); return }
        setError('')
        onChange(new File([selected], selected.name, { type: 'audio/wav' }))
      }} />
    </label>
    {file ? <div>
      <p>Selected: {file.name}. Listen before sending. Duration and format are also checked on the server.</p>
      {preview ? <audio ref={previewAudio} controls preload="metadata" src={preview} aria-label="Preview your voice message" style={{ maxWidth: '100%' }} /> : null}
      <button type="button" disabled={disabled || recording || starting} onClick={() => onChange(null)} style={{ display: 'block', minHeight: 44 }}>Remove selected recording</button>
    </div> : null}
  </section>
}

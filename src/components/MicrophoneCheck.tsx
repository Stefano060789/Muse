import { useEffect, useRef, useState } from 'react'

export default function MicrophoneCheck({ beforeTest, stopSignal }: { beforeTest: () => void; stopSignal: string }) {
  const [active, setActive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [level, setLevel] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const stream = useRef<MediaStream | null>(null)
  const context = useRef<AudioContext | null>(null)
  const frame = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generation = useRef(0)

  const release = () => {
    generation.current += 1
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
    const audioContext = context.current
    context.current = null
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch(() => console.warn('Microphone test audio context could not close.'))
    }
  }

  const stop = () => {
    release()
    setActive(false)
    setStarting(false)
    setLevel(0)
  }

  useEffect(() => () => release(), [])
  useEffect(() => {
    if (stopSignal) stop()
  }, [stopSignal])

  const test = async () => {
    if (active || starting) { stop(); return }
    beforeTest()
    release()
    const id = generation.current
    setError('')
    setMessage('Requesting microphone access. Speak when the input meter appears.')
    setStarting(true)
    let acquired: MediaStream | null = null
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone capture is unavailable here. Use localhost or HTTPS in a supported browser.')
      acquired = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (generation.current !== id) { acquired.getTracks().forEach(track => track.stop()); return }
      stream.current = acquired
      const audioContext = new AudioContext()
      context.current = audioContext
      await audioContext.resume()
      if (generation.current !== id) return
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 1024
      audioContext.createMediaStreamSource(acquired).connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      let maximum = 0
      setActive(true)
      setStarting(false)
      const label = acquired.getAudioTracks()[0]?.label || 'Browser default microphone'
      setMessage(`Testing ${label}. Speak now. A moving meter confirms audio input, not speech transcription.`)
      const measure = () => {
        if (generation.current !== id) return
        analyser.getByteTimeDomainData(data)
        const rms = Math.sqrt(data.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / data.length)
        maximum = Math.max(maximum, rms)
        setLevel(Math.min(100, Math.round(rms * 500)))
        frame.current = requestAnimationFrame(measure)
      }
      measure()
      timer.current = setTimeout(() => {
        if (generation.current !== id) return
        stop()
        setMessage(maximum > 0.01
          ? 'Audio input was detected. If dictation still fails, check the dictation language and browser recognition service. The meter cannot verify words or which speaker made the sound.'
          : 'Little or no audio reached the browser. Check your microphone mute switch, input volume and default microphone in your browser or device settings, then test again.')
      }, 10000)
    } catch (cause) {
      if (generation.current !== id) return
      release()
      setActive(false)
      setStarting(false)
      const name = cause instanceof Error ? cause.name : ''
      setError(name === 'NotAllowedError' ? 'Microphone access is blocked. Allow microphone access for this site in your browser and check your device privacy settings, then try again.'
        : name === 'NotFoundError' ? 'No microphone was found. Connect or enable an input device.'
          : name === 'NotReadableError' ? 'The microphone could not be opened. Check whether another app is using it exclusively.'
            : cause instanceof Error ? cause.message : 'Could not test the microphone.')
    }
  }

  return <details style={{ padding: '1rem', border: '1px solid #d9cfc5', borderRadius: 12, marginBottom: '1rem' }}>
    <summary>Test microphone</summary>
    <p>10-second local test. Nothing is recorded or sent.</p>
    <p>Change your default microphone in browser or system settings.</p>
    <button type="button" onClick={() => void test()}>{active || starting ? 'Stop microphone test' : 'Test microphone for 10 seconds'}</button>
    {active ? <div><label>Input level <meter min={0} max={100} value={level} aria-label="Microphone input level" /> {level}%</label></div> : null}
    {message ? <p role="status">{message}</p> : null}
    {error ? <>
      <p role="alert">{error}</p>
      <details><summary>How to allow microphone access</summary>
        <ul>
          <li>In your browser, open this site&apos;s permissions from the address-bar site icon and allow Microphone.</li>
          <li>Check that microphone access is enabled for your browser in your device&apos;s privacy settings.</li>
          <li>Reload this page, then choose Test microphone again. Dictation may also require speech recognition permission.</li>
        </ul>
      </details>
    </> : null}
  </details>
}

import { useEffect, useRef, useState } from 'react'

export default function SampleNarration({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const audio = audioRef.current
    return () => { audio?.pause() }
  }, [])
  return <section aria-label="Sample narration" style={{ margin: '1rem 0' }}>
    <p>{label} - prerecorded Google WaveNet voice. Tap Play below; listening is free.</p>
    <audio ref={audioRef} src={src} controls preload="none" aria-label={label}
      onError={() => setFailed(true)} onLoadedMetadata={() => setFailed(false)}
      style={{ display: 'block', width: '100%', maxWidth: '100%' }} />
    {failed ? <p role="alert">The sample recording could not be played. Reload the page to retry, or keep reading. Muse has not switched to a device voice.</p> : null}
  </section>
}

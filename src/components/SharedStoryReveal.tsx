import { useRef, type CSSProperties } from 'react'
import NarrationControls, { NarrationButton } from './NarrationControls'
import type { SharedMediaKind } from '../lib/sharedStoryMedia'

type Narrator = Parameters<typeof NarrationControls>[0]['narrator']

// The surprise only exists after the server authorizes solving or skipping; the url is
// either a short-lived private signed URL or a same-origin blob: URL.
export type RevealMedia = {
  kind: SharedMediaKind
  state: 'loading' | 'ready' | 'error'
  url?: string
}

export default function SharedStoryReveal({ message, media, narrator, beforeSpeak, onMediaError, onRetryMedia, style }: {
  message?: string
  media?: RevealMedia | null
  narrator: Narrator
  beforeSpeak: () => void
  onMediaError?: () => void
  onRetryMedia?: () => void
  style?: CSSProperties
}) {
  // When an expired private URL is refreshed, playback resumes where it stopped.
  const resumeAt = useRef(0)
  const text = message?.trim() ? message : ''
  const label = media?.kind === 'video' ? 'video' : media ? 'photo' : 'message'
  return <section aria-label={`Your revealed ${label}`} style={style}>
    <h2>Your surprise</h2>
    {text && <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</p>}
    {media?.state === 'loading' && <p role="status">Loading your surprise {label}…</p>}
    {media?.state === 'error' && <p role="alert">
      The {label} could not be loaded. {onRetryMedia && <button type="button" onClick={onRetryMedia}>Try again</button>}
    </p>}
    {media?.state === 'ready' && media.url && (media.kind === 'photo'
      ? <img src={media.url} alt="The creator's surprise photo" onError={onMediaError} referrerPolicy="no-referrer"
        style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', borderRadius: 12, margin: '12px 0' }} />
      : <video src={media.url} controls preload="metadata" playsInline onError={onMediaError}
        onTimeUpdate={event => { resumeAt.current = event.currentTarget.currentTime }}
        onLoadedMetadata={event => { if (resumeAt.current > 0 && resumeAt.current < event.currentTarget.duration) event.currentTarget.currentTime = resumeAt.current }}
        aria-label="The creator's surprise video"
        style={{ display: 'block', width: '100%', maxHeight: '70vh', borderRadius: 12, margin: '12px 0', background: '#000' }} />)}
    {text && <NarrationButton narrator={narrator} text={text} label="Play the final message" beforeSpeak={beforeSpeak} context={{ progress: 1, ending: true }} />}
  </section>
}
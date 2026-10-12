import type { CSSProperties } from 'react'
import NarrationControls, { NarrationButton } from './NarrationControls'

type Narrator = Parameters<typeof NarrationControls>[0]['narrator']

export default function SharedStoryReveal({ message, narrator, beforeSpeak, style }: {
  message: string
  narrator: Narrator
  beforeSpeak: () => void
  style?: CSSProperties
}) {
  return <section aria-label="Your revealed message" style={style}>
    <h2>You found it. Here is your message.</h2>
    <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message}</p>
    <NarrationButton narrator={narrator} text={message} label="Play the final message" beforeSpeak={beforeSpeak} />
  </section>
}

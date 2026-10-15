import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { SAMPLE_STORY, sampleAnswerMatches } from '../lib/sampleStory'
import { useNarration } from '../lib/useNarration'
import { NarrationButton } from '../components/NarrationControls'

const button = { padding: '0.85rem 1.1rem', minHeight: 48, borderRadius: 28, border: '1px solid #d9cfc5', cursor: 'pointer', fontSize: '1rem' }

export default function DemoPage() {
  const [opened, setOpened] = useState(false)
  const [scene, setScene] = useState(0)
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [hint, setHint] = useState(false)
  const [feedback, setFeedback] = useState('')
  const narrator = useNarration({ narrationLanguage: 'en-US', narrationStyle: 'warm' }, undefined, {}, { browserOnly: true })
  const current = SAMPLE_STORY.scenes[scene]
  return <main style={{ minHeight: '85vh', background: '#f7f3ed', color: '#2d2926', fontFamily: 'Georgia, serif' }}>
    <Head><title>Muse - Try a sample story</title><meta name="description" content="Try an original, fictional Muse mystery. No account, AI generation or private recipient data." /><meta name="referrer" content="no-referrer" /></Head>
    <div style={{ maxWidth: 640, margin: 'auto', padding: '1.5rem' }}>
      <Link href="/" style={{ color: 'inherit', display: 'inline-block', padding: '0.75rem 0' }}>Muse</Link>
      <p style={{ fontSize: '0.9rem' }}>Sample story - fictional, handcrafted, and free to try. This is not a real gift or an AI-generated result.</p>
      {narrator.error ? <p role="alert">{narrator.error}</p> : null}
      {!opened ? <section style={{ textAlign: 'center', padding: '3rem 0' }}>
        <p>A little adventure for you</p><h1 style={{ fontSize: 'clamp(2rem, 7vw, 3rem)' }}>{SAMPLE_STORY.title}</h1>
        <p style={{ lineHeight: 1.8 }}>{SAMPLE_STORY.dedication}</p>
        <button style={{ ...button, background: '#2d2926', color: 'white' }} onClick={() => setOpened(true)}>Open sample story</button>
        <p>About two minutes. Nothing plays automatically.</p>
      </section> : revealed ? <section>
        <h1>Your sample surprise</h1><p style={{ lineHeight: 1.8 }}>{SAMPLE_STORY.message}</p>
        <NarrationButton narrator={narrator} text={SAMPLE_STORY.message} label="Listen to the message" />
        <p>This is how a thoughtful gift can end. Your own story can include a private message, photo, video or voice recording.</p>
        <Link href="/shared#new" style={{ ...button, display: 'inline-block', background: '#2d2926', color: 'white', textDecoration: 'none' }}>Make a story for someone</Link>
        <p><Link href="/story" style={{ color: 'inherit' }}>Or try a story for yourself</Link></p>
        <button style={button} onClick={() => { narrator.stop(); setOpened(false); setScene(0); setRevealed(false); setHint(false); setAnswer(''); setFeedback('') }}>Try the sample again</button>
      </section> : <section>
        <p>Scene {scene + 1} of {SAMPLE_STORY.scenes.length}</p><h1>{current.title}</h1>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{current.body}</p><p style={{ lineHeight: 1.7 }}><strong>Clue:</strong> {current.clue}</p>
        <NarrationButton narrator={narrator} text={`${current.title}. ${current.body} ${current.clue}`} label="Listen to this scene" />
        {scene === 0 ? <p><button style={{ ...button, background: '#2d2926', color: 'white' }} onClick={() => { narrator.stop(); setScene(1) }}>Follow the lanterns</button></p> : <form onSubmit={event => {
          event.preventDefault()
          if (sampleAnswerMatches(answer)) { narrator.stop(); setRevealed(true); setFeedback('') }
          else setFeedback('Not quite. Think of a meal shared outside. You can try again or open the sample reveal below.')
        }}>
          <label htmlFor="sample-answer">What has Sam planned?</label>
          <input id="sample-answer" value={answer} onChange={event => setAnswer(event.target.value)} maxLength={80} required style={{ width: '100%', boxSizing: 'border-box', padding: '0.85rem', fontSize: '1rem', margin: '0.75rem 0', border: '1px solid #d9cfc5', borderRadius: 8 }} />
          <button style={{ ...button, background: '#2d2926', color: 'white' }}>Try this answer</button>
          {feedback ? <p role="status">{feedback}</p> : null}
        </form>}
        <details style={{ margin: '1.5rem 0' }}><summary>Need a little help?</summary>
          <button style={{ ...button, marginTop: 12 }} onClick={() => setHint(true)}>Show a hint</button>
          {hint ? <p>The answer is a picnic. This sample is here to show how Muse works, not to test you.</p> : null}
          <p><button style={button} onClick={() => { narrator.stop(); setRevealed(true) }}>Open the sample reveal</button></p>
        </details>
      </section>}
      <p style={{ fontSize: '0.9rem', lineHeight: 1.6, marginTop: '2rem' }}>This demo makes no story-generation requests and saves no playthrough. Optional narration uses your device/browser speech service; voice availability varies.</p>
    </div>
  </main>
}

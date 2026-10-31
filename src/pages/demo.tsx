import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { sampleAnswerMatches, sampleStoryForLanguage } from '../lib/sampleStory'
import { demoLocalization } from '../lib/demoPageLocalization'
import sampleAudio from '../lib/sampleAudio.json'
import SampleNarration from '../components/SampleNarration'
import { useInterfaceLanguage } from '../lib/interfaceLanguage'

const button = { padding: '0.85rem 1.1rem', minHeight: 48, borderRadius: 28, border: '1px solid #d9cfc5', cursor: 'pointer', fontSize: '1rem' }

export default function DemoPage() {
  const language = useInterfaceLanguage()
  const story = sampleStoryForLanguage(language)
  const { copy } = demoLocalization(language)
  const english = language === 'en-US'
  const [opened, setOpened] = useState(false)
  const [scene, setScene] = useState(0)
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [hint, setHint] = useState(false)
  const [feedback, setFeedback] = useState('')
  const current = story.scenes[scene]
  const recording = scene === 0 ? sampleAudio['scene-1'] : sampleAudio['scene-2']
  const narrationText = `${current.title}. ${current.body} ${copy.clueLabel} ${current.clue}`
  const narrationProps = (label: string, text: string, src = recording.src) => english
    ? { src, label }
    : { src: '', label, browserOnly: true as const, language, text, copy }
  return <main className="atelier-page" lang={language} dir={language === 'ar-SA' ? 'rtl' : 'ltr'}>
    <Head><title>{copy.title}</title><meta name="description" content={copy.description} /><meta name="referrer" content="no-referrer" /></Head>
    <div className="atelier-shell atelier-shell--narrow">
      <div className="atelier-reading">
      <p style={{ fontSize: '0.9rem' }}>{copy.sampleNotice}</p>
      {!opened ? <section className="atelier-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p>{copy.openingPrompt}</p><h1 style={{ fontSize: 'clamp(2rem, 7vw, 3rem)' }}>{story.title}</h1>
        <p style={{ lineHeight: 1.8 }}>{story.dedication}</p>
        <button style={{ ...button, background: '#2d2926', color: 'white' }} onClick={() => setOpened(true)}>{copy.openStory}</button>
        <p>{copy.durationNotice}</p>
      </section> : revealed ? <section className="atelier-card">
        <h1>{copy.revealHeading}</h1><p style={{ lineHeight: 1.8 }}>{story.message}</p>
        <SampleNarration key={english ? sampleAudio.message.src : `browser-message-${language}`} {...narrationProps(copy.listenScene, story.message, sampleAudio.message.src)} />
        <p>{copy.revealFor}</p>
        <Link href="/shared#new" style={{ ...button, display: 'inline-block', background: '#2d2926', color: 'white', textDecoration: 'none' }}>{copy.createGift}</Link>
        <p><Link href="/story?new=1" style={{ color: 'inherit' }}>{copy.tryPersonal}</Link></p>
        <button style={button} onClick={() => { setOpened(false); setScene(0); setRevealed(false); setHint(false); setAnswer(''); setFeedback('') }}>{copy.restart}</button>
      </section> : <section className="atelier-card">
        <p>{copy.sceneCount(scene + 1, story.scenes.length)}</p><h1>{current.title}</h1>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{current.body}</p><p style={{ lineHeight: 1.7 }}><strong>{copy.clueLabel}</strong> {current.clue}</p>
        <SampleNarration key={english ? recording.src : `browser-scene-${language}-${scene}`} {...narrationProps(copy.listenScene, narrationText)} />
        {scene === 0 ? <p><button style={{ ...button, background: '#2d2926', color: 'white' }} onClick={() => setScene(1)}>{copy.continue}</button></p> : <form onSubmit={event => {
          event.preventDefault()
          if (sampleAnswerMatches(answer, language)) { setRevealed(true); setFeedback('') }
          else setFeedback(copy.incorrectAnswer)
        }}>
          <label htmlFor="sample-answer">{copy.answerQuestion}</label>
          <input id="sample-answer" value={answer} onChange={event => setAnswer(event.target.value)} maxLength={80} required placeholder={copy.answerPlaceholder} style={{ width: '100%', boxSizing: 'border-box', padding: '0.85rem', fontSize: '1rem', margin: '0.75rem 0', border: '1px solid #d9cfc5', borderRadius: 8 }} />
          <button style={{ ...button, background: '#2d2926', color: 'white' }}>{copy.submitAnswer}</button>
          {feedback ? <p role="status">{feedback}</p> : null}
        </form>}
        <details style={{ margin: '1.5rem 0' }}><summary>{copy.hintPrompt}</summary>
          <button style={{ ...button, marginTop: 12 }} onClick={() => setHint(true)}>{copy.showHint}</button>
          {hint ? <p>{copy.hint}</p> : null}
          <p><button style={button} onClick={() => setRevealed(true)}>{copy.revealButton}</button></p>
        </details>
      </section>}
      <p style={{ fontSize: '0.9rem', lineHeight: 1.6, marginTop: '2rem' }}>{copy.privacyNotice}</p>
      </div>
    </div>
  </main>
}

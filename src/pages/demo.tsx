import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { sampleStoryForLanguage } from '../lib/sampleStory'
import { demoLocalization } from '../lib/demoPageLocalization'
import SampleNarration from '../components/SampleNarration'
import { useInterfaceLanguage } from '../lib/interfaceLanguage'

const button = { padding: '0.85rem 1.1rem', minHeight: 48, borderRadius: 28, border: '1px solid #d9cfc5', cursor: 'pointer', fontSize: '1rem' }

export default function DemoPage() {
  const language = useInterfaceLanguage()
  const story = sampleStoryForLanguage(language)
  const { copy } = demoLocalization(language)
  const [opened, setOpened] = useState(false)
  const [scene, setScene] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [selectedChoices, setSelectedChoices] = useState<string[]>([])
  const current = story.scenes[scene]
  const selectedChoice = selectedChoices[scene] || ''
  const narrationText = `${current.title}. ${current.body} ${current.question} ${current.choices.join('. ')}`
  const narrationProps = (label: string, text: string) => ({ label, browserOnly: true as const, language, text, copy })
  const continueStory = () => {
    if (!selectedChoice) return
    if (scene === story.scenes.length - 1) setRevealed(true)
    else setScene(currentScene => currentScene + 1)
  }
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
        <SampleNarration key={`browser-message-${language}`} {...narrationProps(copy.listenScene, story.message)} />
        <h2>{copy.yourChoices}</h2>
        <ol>{selectedChoices.map((choice, index) => <li key={`${index}:${choice}`}>{choice}</li>)}</ol>
        <p>{copy.revealFor}</p>
        <Link href="/shared#new" style={{ ...button, display: 'inline-block', background: '#2d2926', color: 'white', textDecoration: 'none' }}>{copy.createGift}</Link>
        <p><Link href="/story?new=1" style={{ color: 'inherit' }}>{copy.tryPersonal}</Link></p>
        <button style={button} onClick={() => { setOpened(false); setScene(0); setRevealed(false); setSelectedChoices([]) }}>{copy.restart}</button>
      </section> : <section className="atelier-card">
        <p>{copy.sceneCount(scene + 1, story.scenes.length)}</p><h1>{current.title}</h1>
        {scene > 0 && selectedChoices[scene - 1]
          ? <p role="status">{copy.choiceEcho.replace('{choice}', selectedChoices[scene - 1])}</p>
          : null}
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{current.body}</p>
        <SampleNarration key={`browser-scene-${language}-${scene}`} {...narrationProps(copy.listenScene, narrationText)} />
        <fieldset style={{ border: 0, padding: 0, margin: '1.5rem 0' }}>
          <legend style={{ fontWeight: 700, marginBottom: 12 }}>{current.question}</legend>
          <div role="group" aria-label={current.question} style={{ display: 'grid', gap: 10 }}>
            {current.choices.map(choice => <button key={choice} type="button" aria-pressed={selectedChoice === choice}
              onClick={() => setSelectedChoices(previous => {
                const next = previous.slice(0, scene)
                next[scene] = choice
                return next
              })}
              style={{ ...button, background: selectedChoice === choice ? '#2d2926' : '#fffaf6', color: selectedChoice === choice ? 'white' : '#2d2926' }}>
              {choice}
            </button>)}
          </div>
        </fieldset>
        <button type="button" disabled={!selectedChoice} style={{ ...button, background: '#2d2926', color: 'white', opacity: selectedChoice ? 1 : 0.55 }}
          onClick={continueStory}>{scene === story.scenes.length - 1 ? copy.revealButton : copy.continue}</button>
      </section>}
      <p style={{ fontSize: '0.9rem', lineHeight: 1.6, marginTop: '2rem' }}>{copy.privacyNotice}</p>
      </div>
    </div>
  </main>
}

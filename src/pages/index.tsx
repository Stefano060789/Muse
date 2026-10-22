import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import InstallApp from '../components/InstallApp'
import { loadStoryLibrary, selectPersonalStory, type LibraryEntry } from '../lib/storyLibrary'

type PersonalLibraryEntry = Extract<LibraryEntry, { kind: 'personal' }>

function isComplete(entry: PersonalLibraryEntry) {
  return entry.story.journey
    ? entry.story.journey.status === 'concluded' || entry.story.journey.status === 'exhausted'
    : entry.story.responses.length >= entry.story.scenes.length
}

export default function Home() {
  const [personalEntries, setPersonalEntries] = useState<PersonalLibraryEntry[]>([])
  const [libraryError, setLibraryError] = useState('')
  const [libraryReady, setLibraryReady] = useState(false)
  const [continueError, setContinueError] = useState('')

  useEffect(() => {
    const refresh = () => {
      try {
        const result = loadStoryLibrary()
        if (result.error) throw new Error(result.error)
        setPersonalEntries(result.library.entries
          .filter((entry): entry is PersonalLibraryEntry => entry.kind === 'personal')
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)))
        setLibraryError('')
      } catch (cause) {
        setLibraryError(cause instanceof Error ? cause.message : 'Could not read your saved stories.')
      } finally {
        setLibraryReady(true)
      }
    }
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const activeStory = personalEntries.find(entry => !isComplete(entry))
  const completedStory = personalEntries.find(isComplete)
  const returnStory = activeStory || completedStory
  const continueStory = (entry: PersonalLibraryEntry) => {
    setContinueError('')
    try {
      selectPersonalStory(entry.id)
      window.location.assign('/story')
    } catch (cause) {
      setContinueError(cause instanceof Error ? cause.message : 'Could not reopen this story.')
    }
  }

  return <>
    <Head>
      <title>Muse - A story for you. A gift story for someone.</title>
      <meta name="description" content="Create an AI-powered story shaped by your choices, or make a personal mystery that reveals a thoughtful gift. Try a free handcrafted sample." />
    </Head>
    <main className="atelier-page atelier-home">
      <div className="atelier-shell">
        <section className="atelier-hero" aria-labelledby="welcome-title">
          <div>
            <p className="atelier-eyebrow">Small adventures. Personal meaning.</p>
            <h1 id="welcome-title">A story to get lost in.<br /><em>A gift story they&apos;ll remember.</em></h1>
            <p className="atelier-subtitle">Create an AI-powered story you shape with your choices. Or give someone a personal mystery with a hidden surprise.</p>
            {libraryReady && !libraryError && returnStory && <section className="atelier-card" aria-label={activeStory ? 'Continue your story' : 'Read your completed story'}>
              <p className="atelier-eyebrow">{activeStory ? 'Continue your story' : 'Your latest completed story'}</p>
              <h2>{returnStory.story.title}</h2>
              <p>{activeStory
                ? `Scene ${Math.min(returnStory.story.currentStep + 1, returnStory.story.scenes.length)} of ${returnStory.story.scenes.length}`
                : 'Completed'}
              </p>
              <button type="button" className="atelier-button" onClick={() => continueStory(returnStory)}>
                {activeStory ? 'Continue story' : 'Read again'}
              </button>
            </section>}
            {libraryError && <p role="alert">{libraryError} Your saved stories have not been changed.</p>}
            {continueError && <p role="alert">{continueError}</p>}
            <Link href="/myself" className="atelier-button atelier-secondary" style={{ display: 'flex', width: '100%', boxSizing: 'border-box', marginTop: '1.5rem' }}>
              Myself
            </Link>
            <div className="atelier-actions">
              <Link href="/story?new=1" className="atelier-button">Create a story</Link>
              <Link href="/shared#new" className="atelier-button atelier-secondary">Create a gift story</Link>
            </div>
            <p className="atelier-note">For yourself: an interactive escape. For someone else: a mystery with a personal surprise.</p>
            <Link href="/demo" className="atelier-sample-link">Try a 2-minute sample</Link>
            <p className="atelier-note">Free, handcrafted, no account needed.</p>
          </div>
          <figure className="atelier-hero-art" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/illustrations/moonlit-passage.svg" width="1200" height="400" alt="" />
          </figure>
        </section>
        <aside className="atelier-home-more" aria-label="More about Muse">
          <p className="atelier-note">Already started? <Link href="/library">Find your saved stories and gift stories</Link>.</p>
          <details>
            <summary>A little more about Muse</summary>
            <p className="atelier-note">Gift story recipients open a private link without an account. AI stories can be imperfect; preview gift stories before sending. Stories have no automatic expiry.</p>
            <InstallApp />
          </details>
        </aside>
      </div>
    </main>
  </>
}

import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import InstallApp from '../components/InstallApp'
import { loadStoryLibrary, selectPersonalStory, type LibraryEntry } from '../lib/storyLibrary'
import { interfaceText, useInterfaceLanguage } from '../lib/interfaceLanguage'
import { interfacePageText as pageText } from '../lib/interfacePages'
import { STORY_LANGUAGES } from '../lib/storyLanguage'

type PersonalLibraryEntry = Extract<LibraryEntry, { kind: 'personal' }>

function isComplete(entry: PersonalLibraryEntry) {
  return entry.story.journey
    ? entry.story.journey.status === 'concluded' || entry.story.journey.status === 'exhausted'
    : entry.story.responses.length >= entry.story.scenes.length ||
      (entry.story.generation === 'ai' && entry.story.currentStep === entry.story.scenes.length - 1)
}

export default function Home() {
  const language = useInterfaceLanguage()
  const direction = STORY_LANGUAGES.find(option => option.code === language)?.dir
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
      <title>{`Muse - ${interfaceText('homeTitle', language)}`}</title>
    </Head>
    <main className="atelier-page atelier-home" lang={language} dir={direction}>
      <div className="atelier-shell">
        <section className="atelier-hero" aria-labelledby="welcome-title">
          <div>
            <p className="atelier-eyebrow">{interfaceText('welcomeEyebrow', language)}</p>
            <h1 id="welcome-title">{interfaceText('homeTitle', language)}<br /><em>{interfaceText('homeGiftTitle', language)}</em></h1>
            {libraryReady && !libraryError && returnStory && <section className="atelier-card" aria-label={activeStory ? pageText('continueStory', language) : pageText('readStory', language)}>
              <p className="atelier-eyebrow">{activeStory ? pageText('continueStory', language) : pageText('storyCompleted', language)}</p>
              <h2>{returnStory.story.title}</h2>
              <p>{activeStory
                ? `${Math.min(returnStory.story.currentStep + 1, returnStory.story.scenes.length)}/${returnStory.story.scenes.length}`
                : pageText('storyCompleted', language)}
              </p>
              <button type="button" className="atelier-button" onClick={() => continueStory(returnStory)}>
                {activeStory ? pageText('continueStory', language) : pageText('readStory', language)}
              </button>
            </section>}
            {libraryError && <p role="alert">{libraryError}</p>}
            {continueError && <p role="alert">{continueError}</p>}
            <Link href="/myself" className="atelier-button atelier-secondary" style={{ display: 'flex', width: '100%', boxSizing: 'border-box', marginTop: '1.5rem' }}>
              {interfaceText('homeMyself', language)}
            </Link>
            <div className="atelier-creation-choices" aria-label={`${interfaceText('homeJustForYou', language)} / ${interfaceText('homeForSomeone', language)}`}>
              <article className="atelier-card atelier-creation-choice">
                <p className="atelier-eyebrow">{interfaceText('homeJustForYou', language)}</p>
                <h2>{interfaceText('homeCreatePersonal', language)}</h2>
                <Link href="/my-stories" className="atelier-button">{interfaceText('homeOpenPersonal', language)}</Link>
              </article>
              <article className="atelier-card atelier-creation-choice">
                <p className="atelier-eyebrow">{interfaceText('homeForSomeone', language)}</p>
                <h2>{interfaceText('homeShareTogether', language)}</h2>
                <Link href="/shared#new" className="atelier-button atelier-secondary">{interfaceText('homeCreateGift', language)}</Link>
              </article>
            </div>
            <Link href="/demo" className="atelier-sample-link">{interfaceText('sample', language)}</Link>
            <p className="atelier-note">{interfaceText('sampleNote', language)}</p>
          </div>
          <figure className="atelier-hero-art" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/illustrations/moonlit-passage.svg" width="1200" height="400" alt="" />
          </figure>
        </section>
        <aside className="atelier-home-more"><InstallApp /></aside>
      </div>
    </main>
  </>
}

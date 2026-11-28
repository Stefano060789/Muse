import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import InstallApp from '../components/InstallApp'
import { loadStoryLibrary, selectPersonalStory, type LibraryEntry } from '../lib/storyLibrary'
import { interfaceText, useInterfaceLanguage } from '../lib/interfaceLanguage'
import { interfacePageText as pageText } from '../lib/interfacePages'
import { STORY_LANGUAGES } from '../lib/storyLanguage'
import { storiesHubCopy } from '../lib/storiesHubCopy'

type PersonalLibraryEntry = Extract<LibraryEntry, { kind: 'personal' }>

function isComplete(entry: PersonalLibraryEntry) {
  return entry.story.journey
    ? entry.story.journey.status === 'concluded' || entry.story.journey.status === 'exhausted'
    : entry.story.responses.length >= entry.story.scenes.length ||
      (entry.story.generation === 'ai' && entry.story.currentStep === entry.story.scenes.length - 1)
}

export default function Home() {
  const language = useInterfaceLanguage()
  const stories = storiesHubCopy(language)
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
        <section className="muse-home-hero" aria-labelledby="welcome-title">
          <div className="muse-home-hero__copy">
            <p className="atelier-eyebrow muse-home-kicker">{interfaceText('welcomeEyebrow', language)}</p>
            <h1 id="welcome-title">{interfaceText('homeTitle', language)}</h1>
            <p className="muse-home-intro">{interfaceText('homeSubtitle', language)}</p>
            <div className="muse-home-sample">
              <Link href="/demo">{interfaceText('sample', language)}<span aria-hidden="true" className="muse-home-arrow">&rarr;</span></Link>
              <p>{interfaceText('sampleNote', language)}</p>
            </div>
          </div>
          <figure className="muse-home-art" aria-hidden="true">
            <div className="muse-home-art__mount">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/illustrations/v0-renaissance-landscape.webp" width="1264" height="848" alt="" fetchPriority="high" />
            </div>
          </figure>
        </section>
        {libraryReady && !libraryError && returnStory && <section className="atelier-card muse-home-return" aria-label={activeStory ? pageText('continueStory', language) : pageText('readStory', language)}>
            <div>
              <p className="atelier-eyebrow">{activeStory ? pageText('continueStory', language) : pageText('storyCompleted', language)}</p>
              <h2>{returnStory.story.title}</h2>
              {activeStory ? <p className="atelier-note">{`${Math.min(returnStory.story.currentStep + 1, returnStory.story.scenes.length)}/${returnStory.story.scenes.length}`}</p> : null}
            </div>
            <button type="button" className="atelier-button" onClick={() => continueStory(returnStory)}>
              {activeStory ? pageText('continueStory', language) : pageText('readStory', language)}
            </button>
          </section>}
        {libraryError && <p role="alert">{libraryError}</p>}
        {continueError && <p role="alert">{continueError}</p>}
        <section className="muse-home-paths" aria-label={stories.subtitle}>
          <Link href="/myself" className="muse-home-choice muse-home-choice--myself">
            <span className="muse-home-choice__number" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7" r="3.5" /><path d="M5 20c.5-4.5 2.8-7 7-7s6.5 2.5 7 7" /></svg>
            </span>
            <div>
              <p className="atelier-eyebrow">{pageText('myselfEyebrow', language)}</p>
              <h2>{interfaceText('homeMyself', language)}</h2>
            </div>
            <span className="muse-home-arrow" aria-hidden="true">&rarr;</span>
          </Link>
          <Link href="/my-stories" className="muse-home-choice" aria-labelledby="personal-story-title">
            <span className="muse-home-choice__number" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M5 20c6-3 6-12 15-17-1.5 10-6 15-13 16M5 20l5-4m1-6 3 2" /></svg>
            </span>
            <div>
              <p className="atelier-eyebrow">{interfaceText('homeJustForYou', language)}</p>
              <h2 id="personal-story-title">{stories.personalTitle}</h2>
              <p className="muse-home-choice__description">{interfaceText('homePersonalDescription', language)}</p>
            </div>
            <span className="muse-home-arrow" aria-hidden="true">&rarr;</span>
          </Link>
          <Link href="/shared#new" className="muse-home-choice muse-home-choice--shared" aria-labelledby="shared-story-title">
            <span className="muse-home-choice__number" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M3 13c4-7 11-8 16-3l3-2-1 7c-1 6-10 8-16 3l-2 2v-7Z" /><circle cx="15" cy="12" r="1" /></svg>
            </span>
            <div>
              <p className="atelier-eyebrow">{interfaceText('homeForSomeone', language)}</p>
              <h2 id="shared-story-title">{stories.sharedTitle}</h2>
              <p className="muse-home-choice__description">{interfaceText('homeSharedDescription', language)}</p>
            </div>
            <span className="muse-home-arrow" aria-hidden="true">&rarr;</span>
          </Link>
        </section>
        <aside className="atelier-home-more"><InstallApp /></aside>
      </div>
    </main>
  </>
}

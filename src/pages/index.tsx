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
              <picture>
                <source media="(max-width: 700px)" srcSet="/illustrations/garden-of-stories-panorama.webp" width="960" height="418" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/illustrations/garden-of-stories-portrait.webp" width="960" height="1120" alt="" fetchPriority="high" />
              </picture>
            </div>
          </figure>
        </section>
        {libraryReady && !libraryError && returnStory && <section className="atelier-card muse-home-return" aria-label={activeStory ? pageText('continueStory', language) : pageText('readStory', language)}>
            <div>
              <p className="atelier-eyebrow">{activeStory ? pageText('continueStory', language) : pageText('storyCompleted', language)}</p>
              <h2>{returnStory.story.title}</h2>
              <p className="atelier-note">{activeStory
                ? `${Math.min(returnStory.story.currentStep + 1, returnStory.story.scenes.length)}/${returnStory.story.scenes.length}`
                : pageText('storyCompleted', language)}
              </p>
            </div>
            <button type="button" className="atelier-button" onClick={() => continueStory(returnStory)}>
              {activeStory ? pageText('continueStory', language) : pageText('readStory', language)}
            </button>
          </section>}
        {libraryError && <p role="alert">{libraryError}</p>}
        {continueError && <p role="alert">{continueError}</p>}
        <section className="muse-home-paths" aria-label={stories.subtitle}>
          <Link href="/my-stories" className="muse-home-choice" aria-labelledby="personal-story-title">
            <span className="muse-home-choice__number" aria-hidden="true">I</span>
            <div>
              <p className="atelier-eyebrow">{interfaceText('homeJustForYou', language)}</p>
              <h2 id="personal-story-title">{stories.personalTitle}</h2>
              <p className="muse-home-choice__description">{interfaceText('homePersonalDescription', language)}</p>
            </div>
            <span className="muse-home-arrow" aria-hidden="true">&rarr;</span>
          </Link>
          <Link href="/shared#new" className="muse-home-choice muse-home-choice--shared" aria-labelledby="shared-story-title">
            <span className="muse-home-choice__number" aria-hidden="true">II</span>
            <div>
              <p className="atelier-eyebrow">{interfaceText('homeForSomeone', language)}</p>
              <h2 id="shared-story-title">{stories.sharedTitle}</h2>
              <p className="muse-home-choice__description">{interfaceText('homeSharedDescription', language)}</p>
            </div>
            <span className="muse-home-arrow" aria-hidden="true">&rarr;</span>
          </Link>
        </section>
        <div className="muse-home-personal">
          <p>{pageText('myselfEyebrow', language)}</p>
          <Link href="/myself">{interfaceText('homeMyself', language)}<span aria-hidden="true" className="muse-home-arrow">&rarr;</span></Link>
        </div>
        <aside className="atelier-home-more"><InstallApp /></aside>
      </div>
    </main>
  </>
}

import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { loadStoryLibrary, saveLibraryPersonalStory, selectPersonalStory, type LibraryEntry } from '../lib/storyLibrary'
import { accountFetch, supabase } from '../lib/accountClient'
import { interfacePageText as text } from '../lib/interfacePages'
import { useInterfaceLanguage } from '../lib/interfaceLanguage'
import PersonalStoryShareCard from '../components/PersonalStoryShareCard'

type PersonalEntry = Extract<LibraryEntry, { kind: 'personal' }>

export default function MyStoriesPage() {
  const interfaceLanguage = useInterfaceLanguage()
  const [entries, setEntries] = useState<PersonalEntry[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const syncPending = useRef(false)
  const refresh = () => {
    const result = loadStoryLibrary()
    setEntries(result.library.entries.filter((entry): entry is PersonalEntry => entry.kind === 'personal')
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)))
    setError(result.error || '')
    setReady(true)
  }
  const sync = async () => {
    if (syncPending.current) return
    syncPending.current = true
    setSyncing(true); setSyncError('')
    try {
      const response = await accountFetch('/api/personal-story', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'journey', action: 'library' })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load your account stories.')
      if (!Array.isArray(data.stories)) throw new Error('The server returned an invalid personal story collection.')
      for (const story of data.stories) saveLibraryPersonalStory(story)
      refresh()
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause.message : 'Could not sync your stories. Saved stories have not been removed.')
    } finally {
      syncPending.current = false
      setSyncing(false)
    }
  }
  useEffect(() => {
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    let active = true
    if (supabase) void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setSyncError('Could not check your account sign-in.')
      else if (data.session) void sync()
    }).catch(() => { if (active) setSyncError('Could not check your account sign-in.') })
    return () => {
      active = false
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  const open = (entry: PersonalEntry, completed: boolean, action?: 'read' | 'continue') => {
    try {
      selectPersonalStory(entry.id)
      window.location.assign(action === 'continue' ? '/story?continue=1'
        : action === 'read' || (completed && entry.story.journey?.status !== 'concluded') ? '/story?read=1' : '/story')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open this story.')
    }
  }
  return <>
    <Head><title>{`Muse - ${text('myStoriesTitle', interfaceLanguage)}`}</title><meta name="description" content={text('myStoriesSubtitle', interfaceLanguage)} /></Head>
    <main className="atelier-page" lang={interfaceLanguage}>
      <div className="atelier-shell atelier-shell--narrow">
        <p className="atelier-eyebrow">{text('myStoriesEyebrow', interfaceLanguage)}</p>
        <h1 className="atelier-title">{text('myStoriesTitle', interfaceLanguage)}</h1>
        <p className="atelier-subtitle">{text('myStoriesSubtitle', interfaceLanguage)}</p>
        <Link href="/story?new=1" className="atelier-button">{text('startNewStory', interfaceLanguage)}</Link>
        <section aria-labelledby="previous-stories-heading" style={{ marginTop: '2rem' }}>
          <h2 id="previous-stories-heading">{text('yourStories', interfaceLanguage)}</h2>
          <button type="button" disabled={syncing} onClick={() => void sync()}>{syncing ? text('syncingStories', interfaceLanguage) : text('syncAccountStories', interfaceLanguage)}</button>
          {error ? <p role="alert">{error} <Link href="/account">Check your account</Link>.</p> : null}
          {syncError ? <p role="alert">{syncError} <Link href="/account">Check your account</Link>.</p> : null}
          {!ready ? <p role="status">{text('loadingStories', interfaceLanguage)}</p> : !entries.length ? <p>{text('emptyPersonalStories', interfaceLanguage)}</p> : entries.map(entry => {
            const journey = entry.story.journey
            const chapterNumber = journey ? entry.story.chapter?.number ?? 1 : undefined
            const completed = entry.story.journey
              ? ['concluded', 'exhausted'].includes(entry.story.journey.status)
              : entry.story.responses.length >= entry.story.scenes.length ||
                (entry.story.generation === 'ai' && entry.story.currentStep === entry.story.scenes.length - 1)
            return <article className="atelier-card" key={entry.id} style={{ marginTop: '1rem' }}>
              <h3>{entry.story.title}</h3>
              {chapterNumber ? <p>{entry.story.chapter?.parentTitle ? `Chapter ${chapterNumber} · Following ${entry.story.chapter.parentTitle}` : `Chapter ${chapterNumber}`}</p> : null}
              <p>{journey?.status === 'concluded' ? `Chapter ${chapterNumber} · ${text('storyCompleted', interfaceLanguage)}`
                : journey?.status === 'exhausted' ? `Chapter ${chapterNumber} · Attempt limit reached; saved scenes available`
                  : journey ? `Chapter ${chapterNumber} · ${text('inProgress', interfaceLanguage)}`
                    : completed ? text('storyCompleted', interfaceLanguage) : text('inProgress', interfaceLanguage)}</p>
              {journey?.status === 'concluded' ? <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => open(entry, true, 'read')}>{text('readChapter', interfaceLanguage)} {chapterNumber}</button>
                <button type="button" className="atelier-button" onClick={() => open(entry, true, 'continue')}>{text('continueToChapter', interfaceLanguage)} {(chapterNumber ?? 1) + 1}</button>
              </div> : <button type="button" className="atelier-button" onClick={() => open(entry, completed)}>{journey?.status === 'exhausted' ? text('readSavedScenes', interfaceLanguage) : completed ? text('readStory', interfaceLanguage) : text('continueStory', interfaceLanguage)}</button>}
              {completed ? <PersonalStoryShareCard story={entry.story} interfaceLanguage={interfaceLanguage} /> : null}
            </article>
          })}
        </section>
        <p className="atelier-note"><Link href="/library">{text('visitArchive', interfaceLanguage)}</Link></p>
      </div>
    </main>
  </>
}

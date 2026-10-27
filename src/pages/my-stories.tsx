import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { loadStoryLibrary, saveLibraryPersonalStory, selectPersonalStory, type LibraryEntry } from '../lib/storyLibrary'
import { accountFetch, supabase } from '../lib/accountClient'

type PersonalEntry = Extract<LibraryEntry, { kind: 'personal' }>

export default function MyStoriesPage() {
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
    <Head><title>Muse - My stories</title><meta name="description" content="Start a personal story or continue an adventure you have already begun." /></Head>
    <main className="atelier-page">
      <div className="atelier-shell atelier-shell--narrow">
        <p className="atelier-eyebrow">Your next adventure</p>
        <h1 className="atelier-title">My stories</h1>
        <p className="atelier-subtitle">Start something new, or pick up where you left off.</p>
        <Link href="/story?new=1" className="atelier-button">Start a new story</Link>
        <section aria-labelledby="previous-stories-heading" style={{ marginTop: '2rem' }}>
          <h2 id="previous-stories-heading">Your stories</h2>
          <button type="button" disabled={syncing} onClick={() => void sync()}>{syncing ? 'Syncing stories...' : 'Sync account stories'}</button>
          {error ? <p role="alert">{error} <Link href="/account">Check your account</Link>.</p> : null}
          {syncError ? <p role="alert">{syncError} <Link href="/account">Check your account</Link>.</p> : null}
          {!ready ? <p role="status">Loading your stories...</p> : !entries.length ? <p>No personal stories here yet. Start your first adventure above, or sync your account stories.</p> : entries.map(entry => {
            const journey = entry.story.journey
            const chapterNumber = journey ? entry.story.chapter?.number ?? 1 : undefined
            const completed = entry.story.journey
              ? ['concluded', 'exhausted'].includes(entry.story.journey.status)
              : entry.story.responses.length >= entry.story.scenes.length ||
                (entry.story.generation === 'ai' && entry.story.currentStep === entry.story.scenes.length - 1)
            return <article className="atelier-card" key={entry.id} style={{ marginTop: '1rem' }}>
              <h3>{entry.story.title}</h3>
              {chapterNumber ? <p>{entry.story.chapter?.parentTitle ? `Chapter ${chapterNumber} · Following ${entry.story.chapter.parentTitle}` : `Chapter ${chapterNumber}`}</p> : null}
              <p>{journey?.status === 'concluded' ? `Chapter ${chapterNumber} · Completed`
                : journey?.status === 'exhausted' ? `Chapter ${chapterNumber} · Attempt limit reached; saved scenes available`
                  : journey ? `Chapter ${chapterNumber} · In progress`
                    : completed ? 'Story completed' : 'In progress'}</p>
              {journey?.status === 'concluded' ? <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => open(entry, true, 'read')}>Read Chapter {chapterNumber}</button>
                <button type="button" className="atelier-button" onClick={() => open(entry, true, 'continue')}>Continue to Chapter {(chapterNumber ?? 1) + 1}</button>
              </div> : <button type="button" className="atelier-button" onClick={() => open(entry, completed)}>{journey?.status === 'exhausted' ? 'Read saved scenes' : completed ? 'Read story' : 'Continue story'}</button>}
            </article>
          })}
        </section>
        <p className="atelier-note"><Link href="/library">Visit the archive</Link> to reread personal stories and find your saved gift stories.</p>
      </div>
    </main>
  </>
}

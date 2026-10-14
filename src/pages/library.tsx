import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { loadStoryLibrary, removeLibraryEntry, selectPersonalStory, type LibraryEntry } from '../lib/storyLibrary'

export default function LibraryPage() {
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const refresh = () => {
    const result = loadStoryLibrary()
    setEntries(result.library.entries.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)))
    setError(result.error || '')
    setReady(true)
  }
  useEffect(() => {
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh) }
  }, [])
  const remove = (entry: LibraryEntry) => {
    if (!window.confirm('Remove this browser entry only? This does not delete a shared story from the server or invalidate its links.')) return
    try { removeLibraryEntry(entry.kind, entry.id); refresh() }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not remove this browser entry.') }
  }
  const openPersonal = (id: string) => {
    try { selectPersonalStory(id); window.location.assign('/story') }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not reopen this story.') }
  }
  return (
    <>
      <Head><title>Muse — Story Library</title><meta name="description" content="Reopen your personal stories and shared story management links saved in this browser." /></Head>
      <main style={{ minHeight: '100vh', background: '#f7f3ed', color: '#2d2926', fontFamily: 'Georgia, serif', padding: '1.5rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <nav style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}><Link href="/">Muse</Link><Link href="/story">My Story</Link><Link href="/shared#new">New Shared Story</Link></nav>
          <h1>Story Library</h1>
          <p>Saved in this browser, not backed up. Keep this browser private.</p>
          <details>
            <summary>Privacy and storage</summary>
            <p>Entries contain answers, progress and private access links. Anyone using this browser may access them.</p>
            <p>Server stories last up to 30 days. Removing an entry does not delete its server story or reset its allowance. Delete shared stories from their management page.</p>
            <p>Personal journeys require your creator code to reopen; it is never saved. Reopening syncs server progress without an AI call.</p>
          </details>
          {error && <div role="alert"><p>{error} Unreadable entries are hidden, not deleted.</p><button onClick={refresh}>Retry</button></div>}
          {!ready && <p role="status">Loading this browser&apos;s library…</p>}
          {ready && !error && !entries.length && <p>No stories saved here yet. <Link href="/story">Create a personal story</Link> or <Link href="/shared#new">create a shared story</Link>.</p>}
          {entries.map(entry => (
            <article key={`${entry.kind}:${entry.id}`} style={{ padding: '1.5rem', margin: '1rem 0', border: '1px solid #d9cfc5', borderRadius: 18, background: '#fffaf6' }}>
              <h2>{entry.kind === 'personal' ? entry.story.title : entry.story.content.title}</h2>
              <p>{entry.kind === 'personal'
                ? entry.story.journey
                  ? `Personal journey · about ${entry.story.journey.duration} minutes · ${entry.story.journey.revision}/${entry.story.journey.maxTurns} attempts · ${entry.story.journey.status} · Reconcile on reopening`
                  : `Personal · ${entry.story.responses.length >= entry.story.scenes.length ? 'Completed' : `Scene ${entry.story.currentStep + 1} of ${entry.story.scenes.length}`}`
                : `Shared · ${Date.parse(entry.story.expiresAt) <= Date.now() ? 'Expiry date passed' : `Expires ${new Date(entry.story.expiresAt).toLocaleDateString()}`} · Remote availability not checked`}</p>
              <p>Saved {new Date(entry.updatedAt).toLocaleString()}</p>
              {entry.kind === 'shared' && entry.story.brief.adventure ? <p>12 actions per playthrough · {entry.story.brief.adventure.actionBudget} total AI attempts, including failures.</p> : null}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {entry.kind === 'personal'
                  ? <button onClick={() => openPersonal(entry.id)}>Continue personal story</button>
                  : <Link href={`/shared#manage=${encodeURIComponent(entry.story.ownerToken)}`}>Open private management page</Link>}
                <button onClick={() => remove(entry)}>Remove browser entry only</button>
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
  )
}

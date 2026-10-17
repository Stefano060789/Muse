import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { loadStoryLibrary, removeLibraryEntry, selectPersonalStory, type LibraryEntry } from '../lib/storyLibrary'
import { recipientShareDetails } from '../lib/sharedStorySharing'

export default function LibraryPage() {
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [origin, setOrigin] = useState('')
  const [copyStatus, setCopyStatus] = useState<{ id: string; message: string } | null>(null)
  const refresh = () => {
    const result = loadStoryLibrary()
    setEntries(result.library.entries.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)))
    setError(result.error || '')
    setReady(true)
    setNow(Date.now())
    setOrigin(window.location.origin)
  }
  useEffect(() => {
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh); window.clearInterval(clock) }
  }, [])
  const remove = (entry: LibraryEntry) => {
    if (!window.confirm('Remove this browser entry only? This does not delete a story gift from the server or invalidate its links.')) return
    try { removeLibraryEntry(entry.kind, entry.id); refresh() }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not remove this browser entry.') }
  }
  const openPersonal = (id: string) => {
    try { selectPersonalStory(id); window.location.assign('/story') }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not reopen this story.') }
  }
  const copyRecipientLink = async (entry: Extract<LibraryEntry, { kind: 'shared' }>) => {
    if (Date.parse(entry.story.expiresAt) <= Date.now() || !entry.story.playToken) {
      setCopyStatus({ id: entry.id, message: 'Recipient link unavailable. The saved local brief can still be reused.' })
      return
    }
    try {
      const details = recipientShareDetails(window.location.origin, entry.story.playToken)
      await navigator.clipboard.writeText(details.url)
      setCopyStatus({ id: entry.id, message: details.localOnly
        ? 'Recipient link copied. This local-only address will not work on another device.'
        : 'Recipient link copied. Anyone with this link can open the story until it expires or is deleted.' })
    } catch {
      setCopyStatus({ id: entry.id, message: 'Could not copy the recipient link. Allow clipboard access or open the management page to share it.' })
    }
  }
  const personalEntries = entries.filter(entry => entry.kind === 'personal')
  const sharedEntries = entries.filter(entry => entry.kind === 'shared')
  return (
    <>
      <Head><title>Muse — Saved stories</title><meta name="description" content="Continue your own stories and manage story gifts saved in this browser." /></Head>
      <main className="atelier-page" style={{ padding: 'clamp(1rem, 4vw, 1.5rem)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p className="atelier-eyebrow">Your collection</p>
          <h1 className="atelier-title">Saved stories</h1>
          <p className="atelier-subtitle">Continue your own stories, or manage the gifts you have created.</p>
          <nav className="muse-section-links" aria-label="Saved story sections">
            <a href="#personal-stories-heading">Stories for me ({personalEntries.length})</a>
            <a href="#shared-stories-heading">Gifts for others ({sharedEntries.length})</a>
          </nav>
          <p role="note">Saved only in this browser, not backed up or synced across devices. Keep this browser private.</p>
          <details>
            <summary>Privacy and storage</summary>
            <p>Entries contain answers, progress and private access links. Anyone using this browser may access them.</p>
            <p>Server stories last up to 30 days. Shared briefs stay saved in this browser independently of recipient completion and server expiry, until you remove them or clear browser storage. This library does not track recipient activity.</p>
            <p>Removing an entry does not delete its server story or reset its allowance. Delete story gifts from their management page. Management and reuse links contain private owner access; do not share them. Only copy the recipient link for sharing.</p>
            <p>Personal journeys require your creator code to reopen; it is never saved. Reopening syncs server progress without an AI call.</p>
          </details>
          {error && <div role="alert"><p>{error} Unreadable entries are hidden, not deleted.</p><button onClick={refresh}>Retry</button></div>}
          {!ready && <p role="status">Loading this browser&apos;s library…</p>}
          {ready && !error && !entries.length && <p>No stories saved here yet. <Link href="/story">Create a story for yourself</Link> or <Link href="/shared#new">create a story gift</Link>.</p>}
          {ready && <section aria-labelledby="personal-stories-heading">
          <h2 id="personal-stories-heading">Stories for me</h2>
          {!personalEntries.length && <p>No personal stories saved in this browser.</p>}
          {personalEntries.map(entry => (
            <article className="atelier-card" key={`${entry.kind}:${entry.id}`} style={{ margin: '1rem 0' }}>
              <h3>{entry.story.title}</h3>
              <p>{entry.story.journey
                  ? `Personal journey · about ${entry.story.journey.duration} minutes · ${entry.story.journey.revision}/${entry.story.journey.maxTurns} attempts · ${entry.story.journey.status} · Reconcile on reopening`
                  : `Personal · ${entry.story.responses.length >= entry.story.scenes.length ? 'Completed' : `Scene ${entry.story.currentStep + 1} of ${entry.story.scenes.length}`}`
              }</p>
              <p>Saved {new Date(entry.updatedAt).toLocaleString()}</p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button className="atelier-button" onClick={() => openPersonal(entry.id)}>Continue personal story</button>
                <button className="atelier-secondary" onClick={() => remove(entry)}>Remove browser entry only</button>
              </div>
            </article>
          ))}
          </section>}
          {ready && <section aria-labelledby="shared-stories-heading">
            <h2 id="shared-stories-heading">Gifts for others</h2>
            <p>Stories you&apos;ve made for someone else. Links expire; saved briefs stay here until you remove them.</p>
            <details>
              <summary>About sharing and reusing</summary>
              <p>These are browser-local copies. Recipient progress and completion are not tracked here. Remote availability not checked.</p>
              <p>Reuse brief opens a new draft from this browser&apos;s saved brief, even after server expiry. It does not reopen the old recipient session or generate a story.</p>
              <p>Management and reuse links are private. Share only the recipient link.</p>
            </details>
            {origin && recipientShareDetails(origin, '').localOnly && <p role="note">Local-only address: recipient links from this browser will not work on another device. Use a publicly reachable Muse address to share.</p>}
            {!sharedEntries.length && <p>No story gifts saved in this browser. <Link href="/shared#new">Create a story gift</Link>.</p>}
            {sharedEntries.map(entry => {
              const expired = Date.parse(entry.story.expiresAt) <= now
              return <article className="atelier-card" key={`shared:${entry.id}`} style={{ margin: '1rem 0' }}>
                <h3>{entry.story.content.title}</h3>
                <p>{expired ? 'Server link expired' : 'Server link expires'}: <time dateTime={entry.story.expiresAt}>{new Date(entry.story.expiresAt).toLocaleString()}</time></p>
                <p>{expired ? 'The expired server link cannot be used. Your local brief is retained and can still be reused.' : 'Server availability is not verified; a story may have been deleted before its expiry.'}</p>
                <details style={{ marginBottom: '1rem' }}>
                  <summary>Story details</summary>
                  <p>Saved in this browser {new Date(entry.updatedAt).toLocaleString()}</p>
                  <p>Server expiry: {entry.story.expiresAt}</p>
                  {entry.story.brief.adventure ? <p>12 actions per playthrough · {entry.story.brief.adventure.actionBudget} total AI attempts, including failures.</p> : null}
                </details>
                {!entry.story.playToken && !expired && <p>No recipient link saved here. Open management to check sharing options.</p>}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <Link className="atelier-secondary" href={`/shared#manage=${encodeURIComponent(entry.story.ownerToken)}`}>Open / manage</Link>
                  <button className="atelier-button" disabled={expired || !entry.story.playToken} onClick={() => copyRecipientLink(entry)}>Copy recipient link</button>
                  <Link className="atelier-secondary" href={`/shared#reuse=${encodeURIComponent(entry.story.ownerToken)}`}>Reuse brief</Link>
                  <button className="atelier-secondary" onClick={() => remove(entry)}>Remove browser entry only</button>
                </div>
                {copyStatus?.id === entry.id && <p role="status">{copyStatus.message}</p>}
              </article>
            })}
          </section>}
        </div>
      </main>
    </>
  )
}

import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { loadStoryLibrary, removeLibraryEntry, restoreLibraryCreatorStories, selectPersonalStory, type LibraryEntry } from '../lib/storyLibrary'
import { recipientShareDetails } from '../lib/sharedStorySharing'
import GiftProgress from '../components/GiftProgress'
import ShareGiftStory from '../components/ShareGiftStory'
import GiftStoryPreview from '../components/GiftStoryPreview'
import type { SharedStoryProgress } from '../lib/sharedStoryProgress'

export default function LibraryPage() {
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [origin, setOrigin] = useState('')
  const [creatorCode, setCreatorCode] = useState('')
  const [recovering, setRecovering] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')
  const [recoveryNotice, setRecoveryNotice] = useState('')
  const [nextPage, setNextPage] = useState<string | null>(null)
  const recover = async (after: string | null = null) => {
    if (recovering || !creatorCode.trim()) return
    setRecovering(true); setRecoveryError(''); setRecoveryNotice('')
    try {
      const response = await fetch('/api/shared-story', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-muse-creator-code': creatorCode },
        body: JSON.stringify({ action: 'library', after })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load stories from the server.')
      if (!Array.isArray(data.stories) || (data.next !== null && typeof data.next !== 'string')) throw new Error('The server returned an invalid story collection.')
      restoreLibraryCreatorStories(data.stories)
      setNextPage(data.next)
      refresh()
      setRecoveryNotice(data.stories.length
        ? `Loaded ${data.stories.length} gift ${data.stories.length === 1 ? 'story' : 'stories'}.`
        : 'No saved gift stories found.')
    } catch (cause) {
      setRecoveryError(cause instanceof Error ? cause.message : 'Could not load stories from the server. Your saved entries were not removed.')
    } finally { setRecovering(false) }
  }
  const refresh = () => {
    const result = loadStoryLibrary()
    setEntries(result.library.entries.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)))
    setError(result.error || '')
    setReady(true)
    setOrigin(window.location.origin)
  }
  useEffect(() => {
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh) }
  }, [])
  const remove = (entry: LibraryEntry) => {
    if (!window.confirm('Remove this browser entry only? This does not delete a gift story from the server or invalidate its links.')) return
    try { removeLibraryEntry(entry.kind, entry.id); refresh() }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not remove this browser entry.') }
  }
  const openPersonal = (id: string) => {
    try { selectPersonalStory(id); window.location.assign('/story') }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not reopen this story.') }
  }
  const loadProgress = async (ownerToken: string): Promise<SharedStoryProgress> => {
    const response = await fetch('/api/shared-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(creatorCode ? { 'x-muse-creator-code': creatorCode } : {}) },
      body: JSON.stringify({ action: 'progress', token: ownerToken })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Could not check completion. If creator access is required, enter your code above and try again.')
    if (!data.progress) throw new Error('Recipient progress was not returned. Try checking again.')
    return data.progress
  }
  const personalEntries = entries.filter(entry => entry.kind === 'personal')
  const sharedEntries = entries.filter(entry => entry.kind === 'shared')
  return (
    <>
      <Head><title>Muse — Saved stories</title><meta name="description" content="Continue your own stories and manage gift stories saved in this browser." /></Head>
      <main className="atelier-page" style={{ padding: 'clamp(1rem, 4vw, 1.5rem)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p className="atelier-eyebrow">Your collection</p>
          <h1 className="atelier-title">Saved stories</h1>
          <p className="atelier-subtitle">Continue your own stories, or manage the gift stories you have created.</p>
          <nav className="muse-section-links" aria-label="Saved story sections">
            <a href="#personal-stories-heading">Stories for me ({personalEntries.length})</a>
            <a href="#shared-stories-heading">Gift stories for others ({sharedEntries.length})</a>
          </nav>
          <p role="note">This collection is saved in this browser. To restore retained gift stories on another device, use Creator access below. Keep this browser private.</p>
          <details>
            <summary>Privacy and storage</summary>
            <p>Entries contain answers, progress and private access links. Anyone using this browser may access them.</p>
            <p>Server stories have no automatic expiry. Shared briefs stay saved in this browser independently of recipient completion, until you remove them or clear browser storage. View story progress loads progress only when you ask.</p>
            <p>Removing an entry does not delete its server story, disable recipient links or reset its allowance. Saved entries contain private owner access; do not share them. Only copy the recipient link for sharing.</p>
            <p>Personal journeys require your creator code to reopen; it is never saved. Reopening syncs server progress without an AI call.</p>
          </details>
          {error && <div role="alert"><p>{error} Unreadable entries are hidden, not deleted.</p><button onClick={refresh}>Retry</button></div>}
          {!ready && <p role="status">Loading this browser&apos;s library…</p>}
          {ready && !error && !entries.length && <p>No stories saved here yet. <Link href="/story">Create a story for yourself</Link> or <Link href="/shared#new">create a gift story</Link>.</p>}
          {ready && <section aria-labelledby="personal-stories-heading">
          <h2 id="personal-stories-heading">Stories for me</h2>
          {!personalEntries.length && <p>No personal stories saved in this browser.</p>}
          {personalEntries.map(entry => (
            <article className="atelier-card" key={`${entry.kind}:${entry.id}`} style={{ margin: '1rem 0' }}>
              <h3>{entry.story.title}</h3>
              {(() => {
                const completed = entry.story.journey
                  ? entry.story.journey.status === 'concluded' || entry.story.journey.status === 'exhausted'
                  : entry.story.responses.length >= entry.story.scenes.length
                return <>
                  <p>{completed ? 'Completed' : `In progress · Scene ${Math.min(entry.story.currentStep + 1, entry.story.scenes.length)} of ${entry.story.scenes.length}`}</p>
                  <details>
                    <summary>Story details</summary>
                    {entry.story.journey && <p>About {entry.story.journey.duration} minutes · up to {entry.story.journey.maxTurns} story steps.</p>}
                    <p>Saved {new Date(entry.updatedAt).toLocaleString()} in this browser.</p>
                  </details>
                </>
              })()}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button className="atelier-button" onClick={() => openPersonal(entry.id)}>
                  {entry.story.journey
                    ? entry.story.journey.status === 'concluded' || entry.story.journey.status === 'exhausted' ? 'Read again' : 'Continue story'
                    : entry.story.responses.length >= entry.story.scenes.length ? 'Read again' : 'Continue story'}
                </button>
                <button className="atelier-secondary" onClick={() => remove(entry)}>Remove from this browser</button>
              </div>
            </article>
          ))}
          </section>}
          {ready && <section aria-labelledby="shared-stories-heading">
            <h2 id="shared-stories-heading">Gift stories for others</h2>
            <details style={{ marginBottom: '1rem' }}>
              <summary>Creator access</summary>
              <label>Creator access code
                <input type="password" autoComplete="off" maxLength={512} value={creatorCode} disabled={recovering} onChange={event => { setCreatorCode(event.target.value); setNextPage(null); setRecoveryNotice(''); setRecoveryError('') }} style={{ display: 'block', width: '100%', maxWidth: 400, boxSizing: 'border-box' }} />
              </label>
              <p>Admin access to all saved gift stories and private sender details. Code not saved.</p>
              <button type="button" disabled={recovering || !creatorCode.trim()} onClick={() => void recover()}>{recovering ? 'Loading stories...' : 'Load stories from server'}</button>
              {nextPage ? <button type="button" disabled={recovering} onClick={() => void recover(nextPage)}>Load more stories</button> : null}
              <details>
                <summary>Recovery details</summary>
                <p>Original links stay unchanged. Recovered links depend on this admin code. Deleted stories cannot be restored. No AI credits used.</p>
              </details>
              {recoveryError ? <p role="alert">{recoveryError}</p> : null}
              {recoveryNotice ? <p role="status">{recoveryNotice}</p> : null}
            </details>
            {origin && recipientShareDetails(origin, '').localOnly && <p role="note">Local-only address: recipient links from this browser will not work on another device. Use a publicly reachable Muse address to share.</p>}
            {!sharedEntries.length && <p>No gift stories saved in this browser. <Link href="/shared#new">Create a gift story</Link>.</p>}
            {sharedEntries.map(entry => {
              const recipient = entry.story.playToken && origin ? recipientShareDetails(origin, entry.story.playToken) : null
              return <article className="atelier-card" key={`shared:${entry.id}`} style={{ margin: '1rem 0' }}>
                <h3>{entry.story.content.title}</h3>
                {!entry.story.playToken && <p>No recipient link saved here.</p>}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {recipient ? <ShareGiftStory recipientUrl={recipient.url} shareText={recipient.text} expiresAt={null}
                    disabled={!entry.story.playToken} localOnly={recipient.localOnly} whatsappUrl={recipient.whatsappUrl}
                    previewContent={<GiftStoryPreview brief={entry.story.brief} content={entry.story.content} />} /> : null}
                  <button className="atelier-secondary" onClick={() => remove(entry)}>Remove story</button>
                  <GiftProgress compact load={() => loadProgress(entry.story.ownerToken)} sceneCount={entry.story.content.scenes.length} adventure={Boolean(entry.story.brief.adventure)} />
                </div>
              </article>
            })}
          </section>}
        </div>
      </main>
    </>
  )
}

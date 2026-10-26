import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { loadStoryLibrary, removeLibraryEntry, restoreLibraryCreatorStories, saveLibraryPersonalStory, selectPersonalStory, type LibraryEntry } from '../lib/storyLibrary'
import { recipientShareDetails } from '../lib/sharedStorySharing'
import GiftProgress from '../components/GiftProgress'
import ShareGiftStory from '../components/ShareGiftStory'
import GiftStoryPreview from '../components/GiftStoryPreview'
import { parseSharedStoryProgress, type SharedStoryProgress } from '../lib/sharedStoryProgress'
import { accountFetch, supabase } from '../lib/accountClient'

export default function LibraryPage() {
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [origin, setOrigin] = useState('')
  const [recovering, setRecovering] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')
  const [recoveryNotice, setRecoveryNotice] = useState('')
  const [progressByStory, setProgressByStory] = useState<Record<string, SharedStoryProgress>>({})
  const recoveryPending = useRef<Promise<Record<string, SharedStoryProgress>> | null>(null)
  const recover = (): Promise<Record<string, SharedStoryProgress>> => {
    if (recoveryPending.current) return recoveryPending.current
    setRecovering(true); setRecoveryError(''); setRecoveryNotice('')
    setProgressByStory({})
    const request = recoverStories().finally(() => {
      recoveryPending.current = null
      setRecovering(false)
    })
    recoveryPending.current = request
    return request
  }
  const recoverStories = async (): Promise<Record<string, SharedStoryProgress>> => {
    try {
      const stories: unknown[] = []
      const progress: Record<string, SharedStoryProgress> = {}
      const cursors = new Set<string>()
      let after: string | null = null
      do {
        const response = await accountFetch('/api/shared-story', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'library', after, includeProgress: true })
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load story progress.')
        if (!Array.isArray(data.stories) || (data.next !== null && typeof data.next !== 'string')) throw new Error('The server returned an invalid story collection.')
        for (const story of data.stories) {
          if (!story || typeof story.ownerToken !== 'string') throw new Error('The server returned an invalid story collection.')
          progress[story.ownerToken.split('.')[0]] = parseSharedStoryProgress(story.progress)
          stories.push(story)
        }
        after = data.next
        if (after) {
          if (cursors.has(after)) throw new Error('Could not finish loading stories. Try again.')
          cursors.add(after)
        }
      } while (after)
      restoreLibraryCreatorStories(stories)
      const personalResponse = await accountFetch('/api/personal-story', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'journey', action: 'library' })
      })
      const personalData = await personalResponse.json()
      if (!personalResponse.ok) throw new Error(personalData.error || 'Could not load personal stories from your account.')
      if (!Array.isArray(personalData.stories)) throw new Error('The server returned an invalid personal story collection.')
      for (const story of personalData.stories) saveLibraryPersonalStory(story)
      setProgressByStory(progress)
      refresh()
      setRecoveryNotice(stories.length || personalData.stories.length
        ? ''
        : 'No saved stories found on this account.')
      return progress
    } catch (cause) {
      setRecoveryError(cause instanceof Error ? cause.message : 'Could not load stories from the server. Your saved entries were not removed.')
      throw cause
    }
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
  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setRecoveryError('Could not check your account sign-in.')
      else if (data.session) void recover().catch(() => undefined)
    })
    return () => { active = false }
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
    const response = await accountFetch('/api/shared-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'progress', token: ownerToken })
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Could not load progress. Sign in to your Muse account and try again.')
    }
    return parseSharedStoryProgress(data.progress)
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
          <p role="note">Gift stories are connected to your Muse account. Personal story progress is saved in this browser.</p>
          <details>
            <summary>Privacy and storage</summary>
            <p>Entries contain answers, progress and private access links. Anyone using this browser may access them.</p>
            <p>Server stories have no automatic expiry. Shared briefs stay saved in this browser independently of recipient completion, until you remove them or clear browser storage. View story progress loads progress only when you ask.</p>
            <p>Removing an entry does not delete its server story, disable recipient links or reset its allowance. Saved entries contain private owner access; do not share them. Only copy the recipient link for sharing.</p>
            <p>Sign in to manage your gift stories and view their progress. Recipient links remain available without an account.</p>
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
            <button type="button" className="atelier-button" disabled={recovering}
              onClick={() => { void recover().catch(() => undefined) }}>
              {recovering ? 'Syncing account stories...' : 'Sync account stories'}
            </button>
            {recoveryError ? <p role="alert">{recoveryError} <Link href="/account">Sign in or create an account</Link>.</p> : null}
            {recoveryNotice ? <p role="status">{recoveryNotice}</p> : null}
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
                    showWhatsapp={false}
                    previewContent={<GiftStoryPreview brief={entry.story.brief} content={entry.story.content} />} /> : null}
                  <button className="atelier-secondary" onClick={() => remove(entry)}>Remove story</button>
                  <GiftProgress compact snapshot={progressByStory[entry.story.ownerToken.split('.')[0]]}
                    load={() => loadProgress(entry.story.ownerToken)} sceneCount={entry.story.content.scenes.length} adventure={Boolean(entry.story.brief.adventure)} />
                </div>
              </article>
            })}
          </section>}
        </div>
      </main>
    </>
  )
}

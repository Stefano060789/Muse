import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { SHARED_STORY_DURATIONS, type SharedStoryBrief, type SharedStoryPlayer } from '../lib/sharedStory'
import { latestCreatorStory, loadStoryLibrary, removeLibraryEntry, saveLibraryCreatorStory, type CreatorStory } from '../lib/storyLibrary'
import { useStoryInteraction } from '../lib/useStoryInteraction'
import { recipientShareDetails, sharedStoryPreviewText } from '../lib/sharedStorySharing'
import { useNarration } from '../lib/useNarration'
import NarrationControls, { NarrationButton } from '../components/NarrationControls'

type PlayerResponse = { player: SharedStoryPlayer; sessionToken: string }

const fieldStyle: CSSProperties = { display: 'block', width: '100%', padding: '0.85rem', marginTop: '0.5rem', boxSizing: 'border-box', fontSize: '1rem', border: '1px solid #d9cfc5', borderRadius: 8, background: '#fff' }
const cardStyle: CSSProperties = { padding: '1.5rem', border: '1px solid #d9cfc5', borderRadius: 18, background: '#fffaf6', marginBottom: '1rem' }
const buttonStyle: CSSProperties = { padding: '0.8rem 1.1rem', borderRadius: 999, border: '1px solid #d9cfc5', cursor: 'pointer', fontSize: '1rem' }
const primaryStyle: CSSProperties = { ...buttonStyle, background: '#2d2926', color: '#fffaf6' }
const blankBrief: SharedStoryBrief = { creatorName: '', recipientName: '', narration: '', setting: '', recipientHints: '', goal: '', solution: '', message: '', durationMinutes: 5, assistanceHints: [], alternativeAnswers: [] }
type AssistanceField = 'assistanceHints' | 'alternativeAnswers'
const assistanceLines = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)

async function request<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/shared-story', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Could not complete the story request.')
  return data as T
}

export default function SharedStoryPage() {
  const [brief, setBrief] = useState<SharedStoryBrief>(blankBrief)
  const [assistanceHintsText, setAssistanceHintsText] = useState('')
  const [alternativeAnswersText, setAlternativeAnswersText] = useState('')
  const [creator, setCreator] = useState<CreatorStory | null>(null)
  const [player, setPlayer] = useState<SharedStoryPlayer | null>(null)
  const [playToken, setPlayToken] = useState('')
  const [sessionToken, setSessionToken] = useState('')
  const [guess, setGuess] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [origin, setOrigin] = useState('')
  const [canDeviceShare, setCanDeviceShare] = useState(false)
  const [sharing, setSharing] = useState(false)
  const narrator = useNarration(player || creator?.content || {})
  const interaction = useStoryInteraction(narrator.stop)

  useEffect(() => {
    let active = true
    setOrigin(window.location.origin)
    setCanDeviceShare(typeof navigator.share === 'function')
    const initialize = async () => {
      try {
        if (new URLSearchParams(window.location.search).has('share')) {
          throw new Error('This old prototype link contains exposed story data and is no longer supported. Ask the creator for a new private story link.')
        }
        const fragment = new URLSearchParams(window.location.hash.slice(1))
        const recipientToken = fragment.get('play')
        if (recipientToken) {
          setPlayToken(recipientToken)
          let savedSession: string | null = null
          try {
            savedSession = window.localStorage.getItem(`muse-shared-player:${recipientToken}`)
          } catch {
            setNotice('This browser cannot save progress. You can play now, but reopening the link will start a new session.')
          }
          const result = await request<PlayerResponse>({ action: 'open', token: recipientToken, ...(savedSession ? { sessionToken: savedSession } : {}) })
          if (!active) return
          setPlayer(result.player)
          setSessionToken(result.sessionToken)
          try {
            window.localStorage.setItem(`muse-shared-player:${recipientToken}`, result.sessionToken)
          } catch {
            setNotice('This browser cannot save progress. You can play now, but reopening the link will start a new session.')
          }
          return
        }
        const libraryResult = loadStoryLibrary()
        if (libraryResult.error) setNotice(libraryResult.error)
        const requestedOwner = fragment.get('manage')
        const matching = libraryResult.library.entries.find(entry => entry.kind === 'shared' && entry.id === requestedOwner)
        const saved = matching?.kind === 'shared' ? matching.story : latestCreatorStory(libraryResult)
        const ownerToken = fragment.get('manage') || (fragment.has('new') ? null : saved?.ownerToken)
        if (ownerToken) {
          const result = await request<Omit<CreatorStory, 'ownerToken' | 'playToken'>>({ action: 'manage', token: ownerToken })
          if (!active) return
          const restored = { ...result, ownerToken, ...(saved?.ownerToken === ownerToken ? { playToken: saved.playToken } : {}) }
          setCreator(restored)
          setBrief(result.brief)
          setAssistanceHintsText((result.brief.assistanceHints ?? []).join('\n'))
          setAlternativeAnswersText((result.brief.alternativeAnswers ?? []).join('\n'))
          try {
            saveLibraryCreatorStory(restored)
          } catch (error) {
            setNotice(`${error instanceof Error ? error.message : 'This browser could not save your management link.'} Keep a copy of your private management link yourself.`)
          }
        }
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : 'Could not open this story.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void initialize()
    return () => { active = false }
  }, [])

  const storeCreator = (story: CreatorStory) => {
    setCreator(story)
    try {
      saveLibraryCreatorStory(story)
      return true
    } catch (error) {
      setNotice(`${error instanceof Error ? error.message : 'This browser could not save the management link.'} The remote story still exists. Copy the private management link now to keep access.`)
      return false
    }
  }

  const generate = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    interaction.stopRecording()
    narrator.stop()
    try {
      const assistanceHints = assistanceLines(assistanceHintsText)
      const alternativeAnswers = assistanceLines(alternativeAnswersText)
      if (assistanceHints.length > 3 || assistanceHints.some(hint => hint.length > 600)) {
        throw new Error('Enter up to 3 assistance hints, with at most 600 characters each.')
      }
      if (alternativeAnswers.length > 5 || alternativeAnswers.some(answer => answer.length > 200)) {
        throw new Error('Enter up to 5 approved alternative answers, with at most 200 characters each.')
      }
      const preparedBrief = { ...brief, assistanceHints, alternativeAnswers }
      const story = await request<CreatorStory>({ action: 'create', brief: preparedBrief })
      setBrief(story.brief)
      setAssistanceHintsText((story.brief.assistanceHints ?? []).join('\n'))
      setAlternativeAnswersText((story.brief.alternativeAnswers ?? []).join('\n'))
      storeCreator(story)
      window.history.replaceState(null, '', `/shared#manage=${story.ownerToken}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not generate the story.')
    } finally {
      setBusy(false)
    }
  }

  const act = async (action: 'guess' | 'next' | 'hint') => {
    setBusy(true)
    setError('')
    interaction.stopRecording()
    narrator.stop()
    try {
      const result = await request<PlayerResponse>({ action, token: playToken, sessionToken, ...(action === 'guess' ? { guess } : {}) })
      setPlayer(result.player)
      if (action !== 'hint') setGuess('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not continue the story.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async (value: string) => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard is unavailable. Select and copy the link below.')
      await navigator.clipboard.writeText(value)
      setNotice('Link copied.')
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not copy the link. Select and copy it manually.')
    }
  }

  const creatorAction = async (action: 'share' | 'delete') => {
    if (!creator) return
    setBusy(true)
    setError('')
    narrator.stop()
    try {
      if (action === 'share') {
        const result = await request<{ playToken: string }>({ action, token: creator.ownerToken })
        const saved = storeCreator({ ...creator, playToken: result.playToken })
        if (saved) setNotice('New recipient link created. Any previous recipient link no longer works.')
      } else {
        await request({ action, token: creator.ownerToken })
        setCreator(null)
        window.history.replaceState(null, '', '/shared#new')
        setNotice('Story deleted. Both private links have stopped working.')
        try {
          removeLibraryEntry('shared', creator.ownerToken)
        } catch (error) {
          setNotice(`Remote story deleted; both private links have stopped working. ${error instanceof Error ? error.message : 'The browser library entry could not be removed.'}`)
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update the story.')
    } finally {
      setBusy(false)
    }
  }

  const textField = (key: Exclude<keyof SharedStoryBrief, 'durationMinutes' | AssistanceField>, label: string, placeholder: string, max: number, optional = false) => (
    <div style={{ marginBottom: '1.2rem' }}>
      <label htmlFor={`brief-${key}`} style={{ fontWeight: 700 }}>{label}{optional ? ' (optional)' : ''}</label>
      <textarea id={`brief-${key}`} required={!optional} value={brief[key]} onChange={(event) => setBrief({ ...brief, [key]: event.target.value })} rows={key === 'setting' || key === 'message' ? 4 : 2} maxLength={max} placeholder={placeholder} style={fieldStyle} disabled={busy} />
      <button type="button" disabled={busy} onClick={() => interaction.dictate(key, (value) => setBrief((current) => ({ ...current, [key]: value.slice(0, max) })))} style={{ ...buttonStyle, marginTop: '0.5rem', fontSize: '0.85rem' }}>
        {interaction.recordingTarget === key ? 'Stop listening' : `Speak: ${label}`}
      </button>
    </div>
  )

  const assistanceField = (key: AssistanceField, label: string, description: string, maxEntries: number, maxEntryLength: number) => {
    const value = key === 'assistanceHints' ? assistanceHintsText : alternativeAnswersText
    const update = key === 'assistanceHints' ? setAssistanceHintsText : setAlternativeAnswersText
    return (
      <div style={{ marginBottom: '1.2rem' }}>
        <label htmlFor={`brief-${key}`} style={{ fontWeight: 700 }}>{label} (optional)</label>
        <textarea id={`brief-${key}`} value={value} onChange={event => update(event.target.value)} rows={maxEntries} maxLength={maxEntries * (maxEntryLength + 2)} placeholder="One entry per line" aria-describedby={`brief-${key}-help`} style={fieldStyle} disabled={busy} />
        <p id={`brief-${key}-help`}>{description} Up to {maxEntries} entries, {maxEntryLength} characters each; one per line.</p>
      </div>
    )
  }

  const audioButton = (text: string) => <NarrationButton narrator={narrator} text={text} beforeSpeak={interaction.stopRecording} />

  const shareDetails = origin && creator?.playToken ? recipientShareDetails(origin, creator.playToken) : null
  const playerLink = shareDetails?.url || ''
  const managementLink = creator ? `${origin}/shared#manage=${creator.ownerToken}` : ''

  const shareOnDevice = async () => {
    if (!shareDetails || shareDetails.localOnly || sharing) return
    setSharing(true)
    setError('')
    narrator.stop()
    try {
      await navigator.share({ title: 'A Muse story for you', text: shareDetails.text, url: shareDetails.url })
      setNotice('Link handed to your device sharing app. Delivery is handled by that app.')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setNotice('Sharing cancelled. Your story and link are unchanged.')
      } else {
        setError('Could not open device sharing. Copy the recipient link or use WhatsApp instead.')
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f7f3ed', color: '#2d2926', fontFamily: 'Georgia, serif' }}>
      <Head>
        <title>Muse - Shared Story</title>
        <meta name="description" content="Give Muse your idea and personal clues. Create a mystery for someone else to solve." />
        <meta name="referrer" content="no-referrer" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div style={{ maxWidth: 850, margin: '0 auto', padding: '1.5rem' }}>
        <header style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
          <Link href="/" style={{ color: 'inherit', fontWeight: 700 }}>MUSE</Link>
          <nav style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link href="/myself" style={{ color: 'inherit' }}>Myself</Link>
            <Link href="/story" style={{ color: 'inherit' }}>My Story</Link>
            <Link href="/shared" style={{ color: 'inherit' }}>Shared Story</Link>
            <Link href="/library" style={{ color: 'inherit' }}>Story Library</Link>
          </nav>
        </header>
        {error || interaction.error ? <p role="alert" style={{ ...cardStyle, color: '#a14329' }}>{error || interaction.error}</p> : null}
        {notice ? <p role="status" style={cardStyle}>{notice}</p> : null}
        <NarrationControls narrator={narrator} beforeSpeak={interaction.stopRecording} />
        {loading ? <p role="status">Opening your private story...</p> : playToken ? player ? (
          <section>
            <p>A story from {player.creatorName} for {player.recipientName}</p>
            <h1 style={{ fontSize: '2.5rem' }}>{player.title}</h1>
            <p style={{ lineHeight: 1.7 }}>{player.description}</p>
            <p>About {player.durationMinutes} minutes including time to think. Read or listen; type or speak your guesses.</p>
            {player.solved ? (
              <article style={cardStyle}>
                <h2>You found it. Here is your message.</h2>
                <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{player.message}</p>
                {audioButton(player.message || '')}
              </article>
            ) : (
              <>
                <article style={cardStyle}>
                  <p>Scene {player.sceneIndex + 1} of {player.sceneCount}</p>
                  <h2>{player.scene.title}</h2>
                  <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{player.scene.body}</p>
                  <p style={{ lineHeight: 1.7 }}><strong>Clue:</strong> {player.scene.clue}</p>
                  {audioButton(`${player.scene.title}. ${player.scene.body} ${player.scene.clue}`)}
                  <button disabled={busy || player.sceneIndex + 1 >= player.sceneCount} onClick={() => act('next')} style={{ ...buttonStyle, marginTop: '1rem' }}>Explore the next clue</button>
                </article>
                {player.discoveries.length > 0 ? (
                  <details style={cardStyle}>
                    <summary>Earlier discoveries ({player.discoveries.length})</summary>
                    {player.discoveries.map((scene, index) => (
                      <article key={index}>
                        <h3>{scene.title}</h3>
                        <p style={{ lineHeight: 1.8 }}>{scene.body}</p>
                        <p><strong>Clue:</strong> {scene.clue}</p>
                        {audioButton(`${scene.body} ${scene.clue}`)}
                      </article>
                    ))}
                  </details>
                ) : null}
                <form onSubmit={(event) => { event.preventDefault(); void act('guess') }} style={cardStyle}>
                  <label style={{ fontWeight: 700 }}>What is the answer?<input value={guess} onChange={(event) => setGuess(event.target.value)} maxLength={200} required style={fieldStyle} disabled={busy} /></label>
                  <p>The exact answer or an alternative explicitly approved by the creator unlocks the message. Capitalization, punctuation and extra spacing do not matter. AI does not judge your answer.</p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button disabled={busy || !guess.trim()} style={primaryStyle}>{busy ? 'Checking...' : 'Try this answer'}</button>
                    <button type="button" disabled={busy} onClick={() => interaction.dictate('guess', (value) => setGuess(value.slice(0, 200)))} style={buttonStyle}>{interaction.recordingTarget === 'guess' ? 'Stop listening' : 'Speak your answer'}</button>
                  </div>
                  <p>Review the transcript before submitting. Up to 30 guesses per player session.</p>
                </form>
              </>
            )}
            {(player.revealedHints.length > 0 || (!player.solved && player.hintsRemaining > 0)) ? (
              <article style={cardStyle}>
                <h2>Optional help from the creator</h2>
                {player.revealedHints.length > 0 ? (
                  <ol>{player.revealedHints.map((hint, index) => <li key={index} style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{hint}</li>)}</ol>
                ) : <p>Hints are revealed only when you ask. Requesting one does not advance the story or use a guess.</p>}
                {!player.solved && player.hintsRemaining > 0 ? (
                  <button disabled={busy} onClick={() => void act('hint')} style={buttonStyle}>Request next hint ({player.hintsRemaining} remaining)</button>
                ) : player.hintsRemaining === 0 ? <p>All available hints have been revealed.</p> : null}
              </article>
            ) : null}
            {player.feedback ? <p role="status">{player.feedback}</p> : null}
          </section>
        ) : <p>Could not open the story. Check the link or ask its creator for a new one.</p> : creator ? (
          <section>
            <p>Creator preview - only your management link can open this view.</p>
            <h1>{creator.content.title}</h1>
            <p>{creator.content.description}</p>
            <p>For {creator.brief.recipientName} - about {creator.brief.durationMinutes} minutes, not a timed challenge.</p>
            <article style={cardStyle}>
              <h2>Listen before sending</h2>
              <p>Hear all scenes and clues in order using the selected narration style. The private answer and final message are excluded from this preview. Listening does not send the story or advance the recipient's progress.</p>
              <NarrationButton narrator={narrator} text={sharedStoryPreviewText(creator.content)} label="Listen to the whole story" beforeSpeak={interaction.stopRecording} />
              <p>You can also open each scene below and listen separately.</p>
            </article>
            {creator.content.scenes.map((scene, index) => (
              <details key={index} style={cardStyle}>
                <summary style={{ cursor: 'pointer' }}>Scene {index + 1}: {scene.title}</summary>
                <p style={{ lineHeight: 1.8 }}>{scene.body}</p>
                <p><strong>Clue:</strong> {scene.clue}</p>
                {audioButton(`${scene.body} ${scene.clue}`)}
              </details>
            ))}
            <article style={cardStyle}>
              <h2>Private answer and reveal</h2>
              <p><strong>Answer:</strong> {creator.brief.solution}</p>
              {(creator.brief.alternativeAnswers ?? []).length > 0 ? (
                <><h3>Approved alternative answers</h3><ul>{creator.brief.alternativeAnswers!.map((answer, index) => <li key={index}>{answer}</li>)}</ul></>
              ) : null}
              {(creator.brief.assistanceHints ?? []).length > 0 ? (
                <><h3>Optional assistance hints, in reveal order</h3><ol>{creator.brief.assistanceHints!.map((hint, index) => <li key={index}>{hint}</li>)}</ol><p>These hints are not included in the story preview; the recipient requests them individually.</p></>
              ) : null}
              <p style={{ whiteSpace: 'pre-wrap' }}>{creator.brief.message}</p>
              <NarrationButton narrator={narrator} text={creator.brief.message} label="Preview the final message" beforeSpeak={interaction.stopRecording} />
              <p>These details are not sent to the recipient before a correct answer.</p>
            </article>
            <article style={cardStyle}>
              <h2>Send the recipient their story</h2>
              <p>Anyone with the recipient link can play. Keep the management link to yourself. Links expire on {new Date(creator.expiresAt).toLocaleDateString()}.</p>
              {playerLink ? <><label>Recipient link<input readOnly value={playerLink} style={fieldStyle} onFocus={(event) => event.target.select()} /></label><button onClick={() => copy(playerLink)} style={{ ...primaryStyle, marginTop: '0.75rem' }}>Copy recipient link</button></> : null}
              {shareDetails ? (
                <>
                  {shareDetails.localOnly ? (
                    <p role="status">Local test link: this address only works on this computer. WhatsApp and device sharing are disabled until Muse is available at a reachable hosted address. You can copy it to test in another browser on this computer.</p>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                      <a href={shareDetails.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={narrator.stop} style={{ ...buttonStyle, color: 'inherit' }}>Share on WhatsApp</a>
                      {canDeviceShare ? <button disabled={busy || sharing} onClick={() => void shareOnDevice()} style={buttonStyle}>{sharing ? 'Opening sharing...' : 'Share with another app'}</button> : null}
                    </div>
                  )}
                  <p>Sharing opens your chosen app; you choose the contact and confirm sending there. Only the recipient link is included, never your private management link, answer or final message. Anyone who receives or is forwarded this link can play. The recipient listens using voices available on their own device; no audio file is sent.</p>
                </>
              ) : null}
              <details style={{ marginTop: '1rem' }}>
                <summary>Your private management link</summary>
                <input aria-label="Private management link" readOnly value={managementLink} style={fieldStyle} onFocus={(event) => event.target.select()} />
                <button onClick={() => copy(managementLink)} style={{ ...buttonStyle, marginTop: '0.5rem' }}>Copy management link</button>
              </details>
              <button disabled={busy} onClick={() => creatorAction('share')} style={{ ...buttonStyle, marginTop: '1rem' }}>Replace recipient link (invalidates the previous one)</button>
            </article>
            <button disabled={busy} onClick={() => { narrator.stop(); setCreator(null); window.history.replaceState(null, '', '/shared#new') }} style={{ ...buttonStyle, marginBottom: '1rem' }}>Edit this brief and generate a new story</button>
            <p>A new generation makes a separate story. Save the existing management link if you want to keep it.</p>
            <a href="/shared#new" style={{ color: 'inherit' }}>Create another story</a>
            <details style={{ marginTop: '1.5rem' }}>
              <summary>Delete this story</summary>
              <p>This permanently removes the story and disables both links.</p>
              <button disabled={busy} onClick={() => creatorAction('delete')} style={buttonStyle}>Permanently delete story</button>
            </details>
          </section>
        ) : (
          <section>
            <p>One creator. One recipient. A mystery prepared by Muse.</p>
            <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 3.6rem)' }}>Your idea, their discovery.</h1>
            <p style={{ fontSize: '1.1rem', lineHeight: 1.7 }}>Describe a story, add clues only you could give, and choose the message waiting at its heart. AI turns your brief into a mystery for the other person to solve.</p>
            <p>Everything can be written or spoken. Voice fills editable text; nothing is submitted until you choose.</p>
            <form onSubmit={generate}>
              <div style={cardStyle}>
                <h2>1. Who is it for?</h2>
                {textField('creatorName', 'Your name', 'Person A', 80)}
                {textField('recipientName', 'Recipient name', 'Person B', 80)}
              </div>
              <div style={cardStyle}>
                <h2>2. Give Muse the story background</h2>
                {textField('narration', 'Narration style', 'A warm, playful detective story, narrated in the second person...', 600)}
                {textField('setting', 'Story idea and setting', 'There is a hidden letter in a room. Describe the room, its objects, and what the recipient can explore...', 3000)}
                {textField('recipientHints', 'Personal hints about the recipient', 'They love astronomy; a familiar blue notebook could be a clue...', 1500, true)}
                {textField('goal', 'What should they find or solve?', 'Find the hiding place of the letter.', 600)}
              </div>
              <div style={cardStyle}>
                <h2>3. Set the private answer and payoff</h2>
                {textField('solution', 'Secret answer', 'The exact answer, e.g. behind the blue notebook', 200)}
                {assistanceField('alternativeAnswers', 'Creator-approved alternative answers', 'Only the answer above and these explicitly approved alternatives are accepted after ignoring case, punctuation and extra spacing. No fuzzy matching or AI correctness judging.', 5, 200)}
                {assistanceField('assistanceHints', 'Progressive assistance hints', 'Write gentle help first, then stronger clues. Hints stay private until the recipient asks for the next one; they do not advance scenes or consume guesses.', 3, 600)}
                {textField('message', 'Message inside the letter or final reveal', 'The message you want them to discover, exactly as you would write it.', 2000)}
                <label style={{ fontWeight: 700 }}>Expected story duration
                  <select value={brief.durationMinutes} onChange={(event) => setBrief({ ...brief, durationMinutes: Number(event.target.value) })} style={fieldStyle} disabled={busy}>
                    {SHARED_STORY_DURATIONS.map((duration) => <option key={duration} value={duration}>{duration} minutes</option>)}
                  </select>
                </label>
                <p>This is an approximate reading/listening and solving duration, not a countdown.</p>
              </div>
              <p>Your brief, including the private answer, approved alternatives, optional hints and message, is sent to the configured AI provider (Claude Haiku by default; OpenAI or Groq if selected by the operator) to prepare the story and stored in the server database (local SQLite for testing, or Supabase for hosted use) for up to 30 days of link access. Hint requests use only your supplied text, without new AI calls. Do not include confidential or sensitive personal information about someone else.</p>
              <p>Generation is limited to 5 requests per hour per connection and 100 per day across the prototype.</p>
              <button disabled={busy} style={{ ...primaryStyle, width: '100%' }}>{busy ? 'Muse is preparing the mystery...' : 'Prepare story with AI'}</button>
            </form>
          </section>
        )}
      </div>
    </main>
  )
}

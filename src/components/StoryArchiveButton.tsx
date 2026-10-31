import { useRef, useState } from 'react'
import { accountFetch } from '../lib/accountClient'
import type { PersonalStory } from '../lib/story'
import { saveLibraryPersonalStory, validatePersonalStory } from '../lib/storyLibrary'
import { storyArchiveCopy, storyArchiveUnavailableCopy } from '../lib/storyArchiveCopy'
import type { StoryLanguageCode } from '../lib/storyLanguage'

export default function StoryArchiveButton({ story, language, onSaved }: {
  story: PersonalStory; language: StoryLanguageCode; onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const lock = useRef(false)
  const copy = storyArchiveCopy(language)
  const missingCopy = storyArchiveUnavailableCopy(language)
  const move = async (browserOnly = false) => {
    if (lock.current) return
    lock.current = true
    setBusy(true); setError(''); setUnavailable(false)
    try {
      let saved: PersonalStory
      if (story.journey && !browserOnly) {
        const response = await accountFetch('/api/personal-story', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'journey', action: story.archived ? 'restore' : 'archive',
            id: story.id, capability: story.journey.capability
          })
        })
        const data = await response.json()
        if (response.status === 404) {
          setUnavailable(true)
          setError(missingCopy.notice)
          return
        }
        if (!response.ok) throw new Error(data.error || copy.error)
        saved = validatePersonalStory(data.story)
        if (saved.id !== story.id || saved.archived !== !story.archived) throw new Error(copy.error)
      } else saved = { ...story, archived: !story.archived }
      saveLibraryPersonalStory(saved)
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.error)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return <>
    <button type="button" disabled={busy} onClick={() => void move()}>{busy ? copy.busy : story.archived ? copy.restore : copy.close}</button>
    {!story.journey ? <small>{copy.local}</small> : null}
    {error ? <p role="alert">{error}</p> : null}
    {unavailable ? <button type="button" disabled={busy} onClick={() => void move(true)}>{missingCopy.move}</button> : null}
  </>
}

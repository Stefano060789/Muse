import { useEffect, useState } from 'react'
import type { CreatorStory } from '../lib/storyLibrary'
import { romanceCopy } from '../lib/storyRomance'
import { storyHasAccess } from '../lib/storyRetention'

export default function PreSendCheck({ story, hasMedia, hasVoice, uploadPending, onReady }: {
  story: CreatorStory
  hasMedia: boolean
  hasVoice: boolean
  uploadPending: boolean
  onReady: (ready: boolean) => void
}) {
  const [previewed, setPreviewed] = useState(false)
  const [answerChecked, setAnswerChecked] = useState(false)
  const [attachmentsChecked, setAttachmentsChecked] = useState(false)
  const [index, setIndex] = useState(0)
  const [preview, setPreview] = useState(false)
  useEffect(() => {
    setPreviewed(false); setAnswerChecked(false); setAttachmentsChecked(false); setIndex(0); setPreview(false)
  }, [story.ownerToken, hasMedia, hasVoice, uploadPending])
  const ready = previewed && answerChecked && attachmentsChecked && !uploadPending && Boolean(story.brief.message || hasMedia) && storyHasAccess(story.expiresAt)
  useEffect(() => { onReady(ready) }, [ready, onReady])
  const scene = story.content.scenes[index]
  return <section aria-label="Before you send">
    <h3>One last look</h3>
    <p>No extra AI calls. This is your check, not an automatic promise that every clue is solvable.</p>
    <button type="button" style={{ padding: '0.8rem 1rem', minHeight: 44 }} onClick={() => { setPreview(true); setIndex(0) }}>Preview the recipient experience</button>
    {preview ? <section aria-label="Recipient preview" style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #d9cfc5', borderRadius: 12 }}>
      <p>Local preview only. No recipient session or progress is created.</p>
      {story.brief.romance ? <aside lang={story.brief.language} dir={story.brief.language === 'ar-SA' ? 'rtl' : undefined} style={{ padding: '0.75rem', border: '1px solid #d9cfc5', borderRadius: 8 }}>
        <strong>{romanceCopy(story.brief.language).title(story.brief.romance)}</strong>
        <p>{romanceCopy(story.brief.language).notice(story.brief.romance)}</p>
        <p>Recipients must opt in before seeing the cover or scenes below. This creator preview does not record recipient consent.</p>
      </aside> : null}
      <p>For {story.brief.recipientName}, from {story.brief.creatorName}. About {story.brief.durationMinutes} minutes.</p>
      <h4>{story.content.title}</h4>
      {story.brief.gift?.dedication ? <p lang={story.brief.language} style={{ whiteSpace: 'pre-wrap' }}>{story.brief.gift.dedication}</p> : null}
      <div lang={story.brief.language} dir={story.brief.language === 'ar-SA' ? 'rtl' : undefined}>
      <p>Scene {index + 1} of {story.content.scenes.length}</p><h4>{scene.title}</h4><p style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{scene.body}</p><p><strong>Clue:</strong> {scene.clue}</p>
      </div>
      {story.brief.adventure ? <p>This shows the prepared clue plan. Live AI actions will adapt it, and are not simulated here.</p> : null}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {index > 0 ? <button type="button" style={{ padding: '0.75rem', minHeight: 44 }} onClick={() => setIndex(index - 1)}>Previous scene</button> : null}
        {index < story.content.scenes.length - 1 ? <button type="button" style={{ padding: '0.75rem', minHeight: 44 }} onClick={() => setIndex(index + 1)}>Next scene</button> :
          <button type="button" style={{ padding: '0.75rem', minHeight: 44 }} onClick={() => { setPreviewed(true); setPreview(false) }}>I reviewed the clues</button>}
      </div>
    </section> : null}
    {previewed ? <p role="status">Clue preview reviewed.</p> : null}
    <label style={{ display: 'block', padding: '0.75rem 0' }}><input type="checkbox" checked={answerChecked} onChange={event => setAnswerChecked(event.target.checked)} /> The clues lead to my intended answer, and I checked its wording and accepted alternatives.</label>
    <label style={{ display: 'block', padding: '0.75rem 0' }}><input type="checkbox" checked={attachmentsChecked} onChange={event => setAttachmentsChecked(event.target.checked)} /> I checked the final message{hasMedia ? ', attached photo/video' : ''}{hasVoice ? ', and voice recording' : ''}. Nothing I want to send is still waiting to upload.</label>
    {uploadPending ? <p role="status">Finish or remove the selected upload before sharing.</p> : null}
    {!storyHasAccess(story.expiresAt) ? <p role="alert">This story link is unavailable. Reopen the story before sending.</p> : null}
    {!story.brief.message && !hasMedia ? <p role="alert">Add the required surprise photo/video before sending this story.</p> : null}
    {!ready ? <p>Recipient sharing appears here after these checks. Your story is prepared; copy the private management link below to keep access.</p> : <p role="status">Ready to send. Keep your management link private.</p>}
  </section>
}

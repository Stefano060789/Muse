import type { SharedStoryBrief, SharedStoryContent } from '../lib/sharedStory'
import { recipientCopy } from '../lib/storyLanguage'

export default function GiftStoryPreview({ brief, content }: {
  brief: SharedStoryBrief
  content: SharedStoryContent
}) {
  const copy = recipientCopy(brief.language)
  return <section aria-label="Recipient presentation preview">
    <p role="note">Sender-only preview. This view does not open the recipient link or create a play session or progress.</p>
    {brief.romance ? <p>Before seeing the gift cover or story text, recipients see a content notice and choose whether to continue.</p> : null}
    {brief.gift ? <article className="atelier-card" style={{ textAlign: 'center' }}>
      <p className="atelier-eyebrow">{copy.madeForYou}</p>
      <h3>{copy.forYou(brief.recipientName)}</h3>
      <p>{copy.from(brief.creatorName)}</p>
      {brief.gift.dedication ? <p style={{ whiteSpace: 'pre-wrap' }}>{brief.gift.dedication}</p> : null}
      <p>{copy.duration(brief.durationMinutes)}</p>
      <p>This is a preview only; opening it here does not record recipient progress.</p>
    </article> : null}
    <article className="atelier-card">
      <p>{copy.storyFrom(brief.creatorName, brief.recipientName)}</p>
      <h3>{content.title}</h3>
      <p>{content.description}</p>
      <p>{copy.duration(brief.durationMinutes)}</p>
      <p>All prepared scenes and clues are shown to you here. Recipients see them as they progress; private answers and reveals are excluded.</p>
      {content.scenes.map((scene, index) => <section key={index} aria-label={`Preview scene ${index + 1}`}>
        <h4>{scene.title}</h4>
        <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{scene.body}</p>
        <p><strong>Clue:</strong> {scene.clue}</p>
      </section>)}
    </article>
  </section>
}

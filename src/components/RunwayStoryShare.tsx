import { runwayShareCopy } from '../lib/runwayShareCopy'
import type { StoryLanguageCode } from '../lib/storyLanguage'
import type { StoryMotif } from '../lib/storyShareArtwork'

export default function RunwayStoryShare({ language }: {
  title: string; passage: string; caption: string; language: StoryLanguageCode; motif: StoryMotif
}) {
  const copy = runwayShareCopy(language)
  return <section className="runway-share" aria-label={copy.statusTitle}>
    <h4>{copy.statusTitle}</h4>
    <p role="status">{copy.unavailable}</p>
  </section>
}

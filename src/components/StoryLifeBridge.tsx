import { useState } from 'react'
import type { PersonalStory } from '../lib/story'
import type { StoryLanguageCode } from '../lib/storyLanguage'
import {
  canShowStoryLifeBridge,
  createStoryLifeBridgeState,
  getStoryLifeBridgeAction,
  getStoryLifeBridgeCopy,
  transitionStoryLifeBridge
} from '../lib/storyLifeBridge'

type Props = {
  story: PersonalStory
  archiveReading: boolean
  language: StoryLanguageCode
}

export default function StoryLifeBridge({ story, archiveReading, language }: Props) {
  const [state, setState] = useState(createStoryLifeBridgeState)
  const copy = getStoryLifeBridgeCopy(language)
  const action = getStoryLifeBridgeAction(story.mood, language, state.actionIndex)

  if (!canShowStoryLifeBridge(story, archiveReading)) return null

  return (
    <section className="atelier-card" aria-labelledby="story-life-bridge-title" lang={language}>
      <h3 id="story-life-bridge-title">{copy.title}</h3>
      <p>{copy.description}</p>
      {state.response === 'offered' ? <p>{action}</p> : null}
      {state.response === 'intended' ? <p role="status">{copy.intended}</p> : null}
      {state.response === 'declined' ? <p role="status">{copy.declined}</p> : null}
      {state.response !== 'declined' ? (
        <div className="atelier-actions">
          {state.response === 'offered' ? <button type="button" className="atelier-button" onClick={() => setState(current => transitionStoryLifeBridge(current, 'try'))}>{copy.tryIt}</button> : null}
          <button type="button" className="atelier-secondary" onClick={() => setState(current => transitionStoryLifeBridge(current, 'another'))}>{copy.chooseAnother}</button>
          <button type="button" className="atelier-secondary" onClick={() => setState(current => transitionStoryLifeBridge(current, 'not-today'))}>{copy.notToday}</button>
        </div>
      ) : null}
    </section>
  )
}

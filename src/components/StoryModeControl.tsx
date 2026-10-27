export type StoryMode = 'read' | 'listen' | null
type ModeCopy = {
  readScene: string
  readDescription: string
  listenScene: string
  listenDescription: string
  experiencePrompt: string
  switchExperience: string
}

const english: ModeCopy = {
  readScene: 'Read this scene',
  readDescription: 'Show the full text. No audio.',
  listenScene: 'Listen to this scene',
  listenDescription: 'Start the voice. Follow the words as they appear.',
  experiencePrompt: 'How would you like to experience this scene?',
  switchExperience: 'You can switch at any time.'
}

export default function StoryModeControl({ mode, onChange, copy = english, language = 'en', direction = 'ltr' }: {
  mode: StoryMode
  onChange: (mode: StoryMode) => void
  copy?: ModeCopy
  language?: string
  direction?: 'ltr' | 'rtl'
}) {
  return <div role="group" aria-label="Story experience" lang={language} dir={direction} className="story-mode-control">
    <p className="story-mode-prompt">{mode === null ? copy.experiencePrompt : copy.switchExperience}</p>
    <button type="button" aria-label={copy.readScene} aria-pressed={mode === 'read'} onClick={() => onChange('read')}>
      <strong>{copy.readScene}</strong><span>{copy.readDescription}</span>
    </button>
    <button type="button" aria-label={copy.listenScene} aria-pressed={mode === 'listen'} onClick={() => onChange('listen')}>
      <strong>{copy.listenScene}</strong><span>{copy.listenDescription}</span>
    </button>
  </div>
}

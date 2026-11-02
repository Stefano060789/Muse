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
  experiencePrompt: 'This scene is ready. Choose Read or Listen.',
  switchExperience: 'You can switch at any time.'
}

export default function StoryModeControl({ mode, onChange, copy = english, language = 'en', direction = 'ltr' }: {
  mode: StoryMode
  onChange: (mode: StoryMode) => void
  copy?: ModeCopy
  language?: string
  direction?: 'ltr' | 'rtl'
}) {
  return <div role="group" aria-label={copy.experiencePrompt} lang={language} dir={direction} className="story-mode-control">
    <p className="story-mode-prompt">{copy.experiencePrompt}</p>
    <button type="button" aria-label={copy.readScene} aria-pressed={mode === 'read'} onClick={() => onChange('read')}>
      <span className="story-mode-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 6.5c-2.2-1.6-5.3-1.8-8-.8v12c2.7-1 5.8-.8 8 .8m0-12c2.2-1.6 5.3-1.8 8-.8v12c-2.7-1-5.8-.8-8 .8m0-12v12" />
        </svg>
      </span>
      <span className="story-mode-copy">
        <strong>{copy.readScene}</strong>
        <span>{copy.readDescription}</span>
      </span>
    </button>
    <button type="button" aria-label={copy.listenScene} aria-pressed={mode === 'listen'} onClick={() => onChange('listen')}>
      <span className="story-mode-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 10v4h4l5 4V6l-5 4H4Z" />
          <path d="M16 9a5 5 0 0 1 0 6m2.5-8.5a8.5 8.5 0 0 1 0 11" />
        </svg>
      </span>
      <span className="story-mode-copy">
        <strong>{copy.listenScene}</strong>
        <span>{copy.listenDescription}</span>
      </span>
    </button>
  </div>
}

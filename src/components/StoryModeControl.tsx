export type StoryMode = 'read' | 'listen' | null

export default function StoryModeControl({ mode, onChange }: { mode: StoryMode; onChange: (mode: StoryMode) => void }) {
  return <div role="group" aria-label="Story experience" lang="en" dir="ltr" className="story-mode-control">
    <p className="story-mode-prompt">{mode === null ? 'How would you like to experience this scene?' : 'You can switch at any time.'}</p>
    <button type="button" aria-label="Read this scene" aria-pressed={mode === 'read'} onClick={() => onChange('read')}>
      <strong>Read this scene</strong><span>Show the full text. No audio.</span>
    </button>
    <button type="button" aria-label="Listen to this scene" aria-pressed={mode === 'listen'} onClick={() => onChange('listen')}>
      <strong>Listen to this scene</strong><span>Start the voice. Follow the words as they appear.</span>
    </button>
  </div>
}

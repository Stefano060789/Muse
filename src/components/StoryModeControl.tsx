export type StoryMode = 'read' | 'listen'

export default function StoryModeControl({ mode, onChange }: { mode: StoryMode; onChange: (mode: StoryMode) => void }) {
  return <div role="group" aria-label="Story experience" lang="en" dir="ltr" className="story-mode-control">
    <button type="button" aria-pressed={mode === 'read'} onClick={() => onChange('read')}>Read</button>
    <button type="button" aria-pressed={mode === 'listen'} onClick={() => onChange('listen')}>Listen</button>
  </div>
}

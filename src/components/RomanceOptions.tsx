import { parseStoryRomance, romanceCopy, type StoryRomance } from '../lib/storyRomance'

export default function RomanceOptions({ value, onChange, confirmed, onConfirm, disabled = false, showConfirmation = true }: {
  value?: StoryRomance
  onChange: (value: StoryRomance | undefined) => void
  confirmed: boolean
  onConfirm: (value: boolean) => void
  disabled?: boolean
  showConfirmation?: boolean
}) {
  const copy = romanceCopy()
  return <details style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #d9cfc5', borderRadius: 12 }}>
    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Romance (optional){value ? ` - ${copy.title(value)}` : ''}</summary>
    <p>For consenting adults. Sweet affection or stronger romantic tension, never graphic sexual content. Intimacy fades to black.</p>
    <label htmlFor="story-romance" style={{ display: 'block', fontWeight: 700 }}>Romance style</label>
    <select id="story-romance" value={value ?? ''} disabled={disabled} onChange={event => {
      onChange(event.target.value === '' ? undefined : parseStoryRomance(event.target.value))
      onConfirm(false)
    }} style={{ display: 'block', maxWidth: '100%', padding: '0.75rem', margin: '0.5rem 0', font: 'inherit' }}>
      <option value="">No romance theme</option>
      <option value="sweet">{copy.sweet}</option>
      <option value="spicy">{copy.spicy}</option>
    </select>
    {value ? <>
      <p>{copy.notice(value)}</p>
      {showConfirmation ? <label style={{ display: 'block', padding: '0.75rem 0', lineHeight: 1.7 }}>
        <input type="checkbox" checked={confirmed} disabled={disabled} onChange={event => onConfirm(event.target.checked)} /> {copy.creatorConfirmation}
      </label> : null}
      <p style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>Shared recipients choose whether to open before seeing the cover or story. This is self-declaration, not verified age or identity. Use fictional adults or people who have agreed to this portrayal; do not upload explicit images or recordings.</p>
    </> : null}
  </details>
}

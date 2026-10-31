import { parseStoryRomance, romanceCopy, type StoryRomance } from '../lib/storyRomance'
import type { StoryLanguageCode } from '../lib/storyLanguage'
import { interfaceFlowText } from '../lib/interfaceFlow'
import { useAccountPermissions } from '../lib/useAccountPermissions'
import { registrationCopy } from '../lib/registrationCopy'

export default function RomanceOptions({ value, onChange, confirmed, onConfirm, disabled = false, showConfirmation = true, language }: {
  value?: StoryRomance
  onChange: (value: StoryRomance | undefined) => void
  confirmed: boolean
  onConfirm: (value: boolean) => void
  disabled?: boolean
  showConfirmation?: boolean
  language?: StoryLanguageCode
}) {
  const copy = romanceCopy(language)
  const permissions = useAccountPermissions()
  return <details style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #d9cfc5', borderRadius: 12 }}>
    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{interfaceFlowText('romanceOptional', language ?? 'en-US')}{value ? ` · ${copy.title(value)}` : ''}</summary>
    <label htmlFor="story-romance" style={{ display: 'block', fontWeight: 700 }}>{interfaceFlowText('romanceStyle', language ?? 'en-US')}</label>
    <select id="story-romance" value={value ?? ''} disabled={disabled} onChange={event => {
      onChange(event.target.value === '' ? undefined : parseStoryRomance(event.target.value))
      onConfirm(false)
    }} style={{ display: 'block', maxWidth: '100%', padding: '0.75rem', margin: '0.5rem 0', font: 'inherit' }}>
      <option value="">{interfaceFlowText('noRomance', language ?? 'en-US')}</option>
      <option value="sweet">{copy.sweet}</option>
      <option value="spicy">{copy.spicy}</option>
    </select>
    {value ? <>
      <p>{copy.notice(value)}</p>
      {permissions.managed && !permissions.romance ? <p><a href="/account">{registrationCopy(language ?? 'en-US').settings}</a></p> : null}
      {showConfirmation && permissions.ready && !permissions.error && !permissions.managed ? <label style={{ display: 'block', padding: '0.75rem 0', lineHeight: 1.7 }}>
        <input type="checkbox" checked={confirmed} disabled={disabled} onChange={event => onConfirm(event.target.checked)} /> {copy.creatorConfirmation}
      </label> : null}
    </> : null}
  </details>
}

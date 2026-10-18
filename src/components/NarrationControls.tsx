import type { CSSProperties } from 'react'
import { NARRATION_STYLES, voiceKey, type NarrationStyle } from '../lib/narration'
import type { useNarration } from '../lib/useNarration'
import type { NarrationContext } from '../lib/immersiveNarration'

type Narrator = ReturnType<typeof useNarration>

// Every control is bounded by its container so long voice names cannot widen phone layouts.
const rowStyle: CSSProperties = { display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center', margin: '1rem 0', maxWidth: '100%', minWidth: 0 }
const buttonStyle: CSSProperties = { maxWidth: '100%', minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }
const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 0, maxWidth: '100%' }
const selectStyle: CSSProperties = { display: 'block', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', textOverflow: 'ellipsis' }

function PlaybackButtons({ narrator, label }: { narrator: Narrator; label: string }) {
  return <>
    <span role="status" aria-live="polite">{narrator.loading ? 'Preparing narration…' : narrator.paused ? 'Narration paused' : 'Narrating…'}</span>
    {narrator.paused
      ? <button type="button" style={buttonStyle} aria-label={`Resume narration: ${label}`} onClick={narrator.resume}>Resume narration</button>
      : narrator.canPause ? <button type="button" style={buttonStyle} aria-label={`Pause narration: ${label}`} onClick={narrator.pause}>Pause narration</button> : null}
    <button type="button" style={buttonStyle} aria-label={`Stop narration: ${label}`} onClick={narrator.stop}>Stop narration</button>
  </>
}

export function NarrationButton({ narrator, text, beforeSpeak, label = 'Listen to this scene', context, showCloudConsent = true }: { narrator: Narrator; text: string; beforeSpeak?: () => void; label?: string; context?: NarrationContext; showCloudConsent?: boolean }) {
  const current = narrator.busy && narrator.activeText === text
  const elsewhere = narrator.busy && !current
  return <div style={rowStyle}>
    {showCloudConsent && narrator.provider === 'google' && !narrator.cloudConsent ? <label>
      <input type="checkbox" checked={false} onChange={event => narrator.setCloudConsent(event.target.checked)} />
      Allow Google Cloud to narrate this text (paid generation when not already saved). <a href="/privacy">Privacy</a>
    </label> : null}
    {narrator.cloudAudioUrl && narrator.activeText === text ? <div style={{ width: '100%' }}>
      <audio src={narrator.cloudAudioUrl} controls preload="metadata" aria-label={label}
        onPlay={event => { beforeSpeak?.(); narrator.onCloudPlay(event.currentTarget) }}
        onPause={event => narrator.onCloudPause(event.currentTarget)}
        onTimeUpdate={event => narrator.onCloudTimeUpdate(event.currentTarget)}
        onEnded={event => narrator.onCloudEnd(event.currentTarget)}
        onError={event => narrator.onCloudError(event.currentTarget)}
        style={{ display: 'block', width: '100%' }} />
      <button type="button" style={buttonStyle} aria-label={`Stop narration: ${label}`} onClick={narrator.stop}>Stop narration</button>
    </div> : current ? <PlaybackButtons narrator={narrator} label={label} />
      : <button type="button" style={buttonStyle} disabled={!text.trim() || elsewhere} title={elsewhere ? 'Stop the current narration before listening to this.' : undefined}
        onClick={() => { beforeSpeak?.(); void narrator.speak(text, context) }}>{label}</button>}
  </div>
}

export default function NarrationControls({ narrator, beforeSpeak, showCloudConsent = true }: { narrator: Narrator; beforeSpeak?: () => void; showCloudConsent?: boolean }) {
  const languages = Array.from(new Set([narrator.language, ...narrator.voices.map((voice) => voice.lang.replace(/_/g, '-'))])).sort()
  const matching = narrator.voices.filter((voice) => voice.lang.toLowerCase().split(/[-_]/)[0] === narrator.language.toLowerCase().split('-')[0])
    .sort((a, b) => a.name.localeCompare(b.name) || a.lang.localeCompare(b.lang))
  const preview = narrator.language.startsWith('de') ? 'Eine neue Geschichte beginnt. Hinter der Tür wartet eine kleine Überraschung.'
    : narrator.language.startsWith('it') ? 'Una nuova storia inizia. Dietro la porta ti aspetta una piccola sorpresa.'
      : 'A new story begins. Beyond the door, a small surprise is waiting.'
  const playingElsewhere = narrator.busy && narrator.activeText !== preview
  return <aside aria-label="Narration settings" style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #d9cfc5', borderRadius: 12, boxSizing: 'border-box', width: '100%', maxWidth: '100%', minWidth: 0, overflowWrap: 'anywhere' }}>
    <p style={{ marginTop: 0 }}><strong>Narration: {narrator.style}</strong> · {narrator.source}</p>
    <p>{narrator.provider === 'browser' ? 'Device voice (free). Quality depends on the voices Safari or your browser makes available; this is not Studio narration.' : `AI-generated voice by ${narrator.provider === 'google' ? 'Google WaveNet' : 'ElevenLabs'}. Recordings do not depend on iPhone speech voices. Failure never starts a device voice automatically.`}</p>
    {narrator.provider !== 'browser' || narrator.deviceOnly ? <label><input type="checkbox" checked={narrator.deviceOnly} onChange={event => narrator.setDeviceOnly(event.target.checked)} /> Use device voice instead (free)</label> : null}
    {narrator.provider === 'browser' ? <details><summary>Improve the voice on iPhone</summary><p>Try a different matching voice below. You can also download enhanced voices in iPhone Accessibility voice settings, then reopen Safari. Safari may not expose every downloaded voice. Turn off expressive pacing below if the delivery sounds unnatural; device voices are not a consistent premium listening experience.</p></details> : null}
    {showCloudConsent && narrator.provider !== 'browser' ? <label><input type="checkbox" checked={narrator.cloudConsent} onChange={event=>narrator.setCloudConsent(event.target.checked)} /> Send spoken text to {narrator.provider === 'google' ? 'Google Cloud' : 'ElevenLabs'} for paid narration. Saved recordings are reused when available. <a href="/privacy">Privacy</a></label> : null}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 11rem), 1fr))', gap: '0.75rem 1rem', maxWidth: '100%', minWidth: 0 }}>
      <label style={fieldStyle}>Voice style <select style={selectStyle} value={narrator.styleOverride} onChange={(event) => narrator.setStyle(event.target.value as NarrationStyle | 'auto')}>
        <option value="auto">Follow this story (recommended)</option>
        {NARRATION_STYLES.map((style) => <option key={style} value={style}>{style}</option>)}
      </select></label>
      <label style={fieldStyle}>Language <select style={selectStyle} value={narrator.languageOverride} onChange={(event) => narrator.setLanguage(event.target.value)}>
        <option value="">Story language ({narrator.languageOverride ? 'auto' : narrator.language})</option>
        {languages.map((language) => <option key={language} value={language}>{language}</option>)}
      </select></label>
      {narrator.provider === 'browser' ? <label style={fieldStyle}>Browser voice <select style={selectStyle} value={matching.some((voice) => voiceKey(voice) === narrator.selectedVoice) ? narrator.selectedVoice : ''} onChange={(event) => narrator.setVoice(event.target.value)}>
        <option value="">Recommended voice</option>
        {matching.map((voice) => <option key={voiceKey(voice)} value={voiceKey(voice)}>{voice.name} · {voice.lang}{voice.localService ? ' · local' : ''}</option>)}
      </select></label> : null}
    </div>
    {narrator.provider === 'browser' ? <p>Voice: {narrator.voice ? `${narrator.voice.name} (${narrator.voice.lang})` : 'none for this language'}. Quality varies by device.</p> : <p>Cloud voice follows the selected language. Styles adjust pacing; they are not separate dramatic actors. Background sound settings below apply to device speech only.</p>}
    <button type="button" style={buttonStyle} onClick={narrator.resetVoice}>Follow story with recommended voice</button>
    <fieldset style={{ margin: '1rem 0', border: '1px solid #d9cfc5', borderRadius: 8, minWidth: 0 }}>
      <legend>Immersive audio</legend>
      <label><input type="checkbox" checked={narrator.immersive.expressive} onChange={event => narrator.setImmersivePreference('expressive', event.target.checked)} /> Expressive pacing and tone</label>
      <div style={rowStyle}>
        <label style={fieldStyle}>Background sound <select style={selectStyle} value={narrator.immersive.soundscape} onChange={event => narrator.setImmersivePreference('soundscape', event.target.value as typeof narrator.immersive.soundscape)}>
          <option value="auto">Follow scene</option>
          <option value="none">Off · voice only</option>
          <option value="rain">Soft rain</option>
          <option value="wind">Gentle wind</option>
          <option value="water">Flowing water</option>
          <option value="crowd">Soft crowd murmur (synthetic)</option>
        </select></label>
        <label style={fieldStyle}>Voice volume · {Math.round(narrator.immersive.voiceVolume * 100)}%
          <input aria-label="Voice volume" type="range" min="0" max="1" step="0.05" value={narrator.immersive.voiceVolume} onChange={event => narrator.setImmersivePreference('voiceVolume', Number(event.target.value))} />
        </label>
        <label style={fieldStyle}>Background level · {Math.round(narrator.immersive.ambientVolume * 100)}%
          <input aria-label="Background volume" type="range" min="0" max="0.3" step="0.01" value={narrator.immersive.ambientVolume} onChange={event => narrator.setImmersivePreference('ambientVolume', Number(event.target.value))} />
        </label>
      </div>
      <p>Sounds are synthetic, local and free. Auto follows scene text. After changing settings, press Play.</p>
      {narrator.ambientKind !== 'none' && narrator.busy ? <p role="status">Soundscape: {narrator.ambientKind}</p> : null}
      {narrator.ambientNotice ? <p role="status">{narrator.ambientNotice}</p> : null}
    </fieldset>
    <p>Settings stay in this browser. Reset keeps your language. Some voices use online speech services.</p>
    {narrator.voiceNotice ? <p role="status">{narrator.voiceNotice}</p> : null}
    {narrator.preferenceNotice ? <p role="status">{narrator.preferenceNotice}</p> : null}
    {narrator.provider === 'browser' ? narrator.supported === false ? <p role="alert">Browser speech is unsupported here. You can still read the story.</p> : narrator.supported && !narrator.voices.length ? <p role="status">Waiting for browser voices. If none appear, check your OS speech settings or try another browser.</p> : null : null}
    <NarrationButton narrator={narrator} text={preview} label="Preview selected style" beforeSpeak={beforeSpeak} showCloudConsent={showCloudConsent} />
    {playingElsewhere && !narrator.cloudAudioUrl ? <div style={rowStyle}><PlaybackButtons narrator={narrator} label="current story narration" /></div> : null}
    {narrator.error ? <p role="alert">{narrator.error}</p> : null}
    {narrator.notice ? <p role="status">{narrator.notice}</p> : null}
  </aside>
}
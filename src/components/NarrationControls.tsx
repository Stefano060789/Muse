import type { CSSProperties } from 'react'
import { NARRATION_STYLES, voiceKey, type NarrationStyle } from '../lib/narration'
import type { useNarration } from '../lib/useNarration'
import type { NarrationContext } from '../lib/immersiveNarration'
import ExplicitConsent from './ExplicitConsent'
import { useInterfaceLanguage } from '../lib/interfaceLanguage'
import { audioControlsCopy, narrationPreview, narrationStyleLabel } from '../lib/audioControlsCopy'
import { interfaceFlowText } from '../lib/interfaceFlow'

type Narrator = ReturnType<typeof useNarration>

// Every control is bounded by its container so long voice names cannot widen phone layouts.
const rowStyle: CSSProperties = { display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center', margin: '1rem 0', maxWidth: '100%', minWidth: 0 }
const buttonStyle: CSSProperties = { maxWidth: '100%', minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }
const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 0, maxWidth: '100%' }
const selectStyle: CSSProperties = { display: 'block', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', textOverflow: 'ellipsis' }

function PlaybackButtons({ narrator, label }: { narrator: Narrator; label: string }) {
  const copy = audioControlsCopy(useInterfaceLanguage())
  return <>
    <span role="status" aria-live="polite">{narrator.loading ? copy.loading : narrator.paused ? copy.pause : copy.voice}</span>
    {narrator.paused
      ? <button type="button" style={buttonStyle} aria-label={`${copy.resume}: ${label}`} onClick={narrator.resume}>{copy.resume}</button>
      : narrator.canPause ? <button type="button" style={buttonStyle} aria-label={`${copy.pause}: ${label}`} onClick={narrator.pause}>{copy.pause}</button> : null}
    <button type="button" style={buttonStyle} aria-label={`${copy.stop}: ${label}`} onClick={narrator.stop}>{copy.stop}</button>
  </>
}

export function NarrationButton({ narrator, text, beforeSpeak, label: requestedLabel, context, showCloudConsent = true }: { narrator: Narrator; text: string; beforeSpeak?: () => void; label?: string; context?: NarrationContext; showCloudConsent?: boolean }) {
  const language = useInterfaceLanguage()
  const copy = audioControlsCopy(language)
  const label = requestedLabel ?? copy.listen
  const current = narrator.busy && narrator.activeText === text
  const elsewhere = narrator.busy && !current
  return <div style={rowStyle}>
    {showCloudConsent && narrator.provider === 'google' && !narrator.cloudConsent ? <ExplicitConsent checked={false} onChange={narrator.setCloudConsent}>
      Allow Google Cloud to narrate this text (paid generation when not already saved). <a href="/privacy">Privacy</a>
    </ExplicitConsent> : null}
    {narrator.cloudAudioUrl && narrator.activeText === text ? <div style={{ width: '100%' }}>
      <audio src={narrator.cloudAudioUrl} controls preload="metadata" aria-label={label}
        onPlay={event => { beforeSpeak?.(); narrator.onCloudPlay(event.currentTarget) }}
        onPause={event => narrator.onCloudPause(event.currentTarget)}
        onTimeUpdate={event => narrator.onCloudTimeUpdate(event.currentTarget)}
        onEnded={event => narrator.onCloudEnd(event.currentTarget)}
        onError={event => narrator.onCloudError(event.currentTarget)}
        style={{ display: 'block', width: '100%' }} />
      <button type="button" style={buttonStyle} aria-label={`${copy.stop}: ${label}`} onClick={narrator.stop}>{copy.stop}</button>
    </div> : current ? <PlaybackButtons narrator={narrator} label={label} />
      : <button type="button" style={buttonStyle} disabled={!text.trim() || elsewhere} title={elsewhere ? 'Stop the current narration before listening to this.' : undefined}
        onClick={() => { beforeSpeak?.(); void narrator.speak(text, context) }}>{label}</button>}
  </div>
}

export default function NarrationControls({ narrator, beforeSpeak, showCloudConsent = true }: { narrator: Narrator; beforeSpeak?: () => void; showCloudConsent?: boolean }) {
  const interfaceLanguage = useInterfaceLanguage()
  const copy = audioControlsCopy(interfaceLanguage)
  const languages = Array.from(new Set([narrator.language, ...narrator.voices.map((voice) => voice.lang.replace(/_/g, '-'))])).sort()
  const matching = narrator.voices.filter((voice) => voice.lang.toLowerCase().split(/[-_]/)[0] === narrator.language.toLowerCase().split('-')[0])
    .sort((a, b) => a.name.localeCompare(b.name) || a.lang.localeCompare(b.lang))
  const preview = narrationPreview(narrator.language)
  const playingElsewhere = narrator.busy && narrator.activeText !== preview
  return <aside aria-label={copy.settings} className="muse-audio-settings" style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #d9cfc5', borderRadius: 12, boxSizing: 'border-box', width: '100%', maxWidth: '100%', minWidth: 0, overflowWrap: 'anywhere' }}>
    <p style={{ marginTop: 0 }}><strong>{narrator.provider === 'browser' ? copy.device : `${copy.cloud} · ${narrator.provider === 'google' ? 'Google' : 'ElevenLabs'}`}</strong></p>
    {narrator.provider !== 'browser' || narrator.deviceOnly ? <label><input type="checkbox" checked={narrator.deviceOnly} onChange={event => narrator.setDeviceOnly(event.target.checked)} /> {copy.deviceChoice}</label> : null}
    {showCloudConsent && narrator.provider !== 'browser' ? <ExplicitConsent checked={narrator.cloudConsent} onChange={narrator.setCloudConsent}>Send spoken text to {narrator.provider === 'google' ? 'Google Cloud' : 'ElevenLabs'} for paid narration. Saved recordings are reused when available. <a href="/privacy">Privacy</a></ExplicitConsent> : null}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 11rem), 1fr))', gap: '0.75rem 1rem', maxWidth: '100%', minWidth: 0 }}>
      <label style={fieldStyle}>{copy.style} <select style={selectStyle} value={narrator.styleOverride} onChange={(event) => narrator.setStyle(event.target.value as NarrationStyle | 'auto')}>
        <option value="auto">{copy.automatic}</option>
        {NARRATION_STYLES.map((style) => <option key={style} value={style}>{narrationStyleLabel(style, interfaceLanguage)}</option>)}
      </select></label>
      <label style={fieldStyle}>{copy.language} <select style={selectStyle} value={narrator.languageOverride} onChange={(event) => narrator.setLanguage(event.target.value)}>
        <option value="">{copy.automatic} ({narrator.language})</option>
        {languages.map((language) => <option key={language} value={language}>{language}</option>)}
      </select></label>
      {narrator.provider === 'browser' ? <label style={fieldStyle}>{copy.voice} <select style={selectStyle} value={matching.some((voice) => voiceKey(voice) === narrator.selectedVoice) ? narrator.selectedVoice : ''} onChange={(event) => narrator.setVoice(event.target.value)}>
        <option value="">{copy.automatic}</option>
        {matching.map((voice) => <option key={voiceKey(voice)} value={voiceKey(voice)}>{voice.name} · {voice.lang}{voice.localService ? ' · local' : ''}</option>)}
      </select></label> : null}
    </div>
    {narrator.provider === 'browser' ? <small>{copy.help}</small> : null}
    <button type="button" style={buttonStyle} onClick={narrator.resetVoice}>{copy.automatic}</button>
    <fieldset style={{ margin: '1rem 0', border: '1px solid #d9cfc5', borderRadius: 8, minWidth: 0 }}>
      <legend>{copy.settings}</legend>
      <label><input type="checkbox" checked={narrator.immersive.expressive} onChange={event => narrator.setImmersivePreference('expressive', event.target.checked)} /> {copy.expressive}</label>
      <div style={rowStyle}>
        <label style={fieldStyle}>{copy.ambience} <select style={selectStyle} value={narrator.immersive.soundscape} onChange={event => narrator.setImmersivePreference('soundscape', event.target.value as typeof narrator.immersive.soundscape)}>
          <option value="auto">{copy.automatic}</option>
          <option value="none">{copy.off}</option>
          <option value="rain">{interfaceFlowText('soundRain', interfaceLanguage)}</option>
          <option value="wind">{interfaceFlowText('soundWind', interfaceLanguage)}</option>
          <option value="water">{interfaceFlowText('soundWater', interfaceLanguage)}</option>
          <option value="crowd">{interfaceFlowText('soundCrowd', interfaceLanguage)}</option>
          <option value="traffic">{interfaceFlowText('soundTraffic', interfaceLanguage)}</option>
          <option value="mystery">{interfaceFlowText('soundMystery', interfaceLanguage)}</option>
        </select></label>
        <label style={fieldStyle}>{copy.voice} · {Math.round(narrator.immersive.voiceVolume * 100)}%
          <input aria-label={`${copy.voice} · ${copy.volume}`} type="range" min="0" max="1" step="0.05" value={narrator.immersive.voiceVolume} onChange={event => narrator.setImmersivePreference('voiceVolume', Number(event.target.value))} />
        </label>
        <label style={fieldStyle}>{copy.ambience} · {Math.round(narrator.immersive.ambientVolume * 100)}%
          <input aria-label={`${copy.ambience} · ${copy.volume}`} type="range" min="0" max="0.3" step="0.01" value={narrator.immersive.ambientVolume} onChange={event => narrator.setImmersivePreference('ambientVolume', Number(event.target.value))} />
        </label>
      </div>
      {narrator.ambientKind !== 'none' && narrator.busy ? <p role="status">Soundscape: {narrator.ambientKind}</p> : null}
      {narrator.ambientNotice ? <p role="status">{narrator.ambientNotice}</p> : null}
    </fieldset>
    {narrator.voiceNotice ? <p role="status">{narrator.voiceNotice}</p> : null}
    {narrator.preferenceNotice ? <p role="status">{narrator.preferenceNotice}</p> : null}
    {narrator.provider === 'browser' ? narrator.supported === false ? <p role="alert">Browser speech is unsupported here. You can still read the story.</p> : narrator.supported && !narrator.voices.length ? <p role="status">Waiting for browser voices. If none appear, check your OS speech settings or try another browser.</p> : null : null}
    <NarrationButton narrator={narrator} text={preview} label={copy.preview} beforeSpeak={beforeSpeak} showCloudConsent={showCloudConsent} />
    {playingElsewhere && !narrator.cloudAudioUrl ? <div style={rowStyle}><PlaybackButtons narrator={narrator} label="current story narration" /></div> : null}
    {narrator.error ? <p role="alert">{narrator.error}</p> : null}
    {narrator.notice ? <p role="status">{narrator.notice}</p> : null}
  </aside>
}
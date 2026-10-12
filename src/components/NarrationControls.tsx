import type { CSSProperties } from 'react'
import { NARRATION_PRESETS, NARRATION_STYLES, voiceKey, type NarrationStyle } from '../lib/narration'
import type { useNarration } from '../lib/useNarration'

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

export function NarrationButton({ narrator, text, beforeSpeak, label = 'Listen to this scene' }: { narrator: Narrator; text: string; beforeSpeak?: () => void; label?: string }) {
  const current = narrator.busy && narrator.activeText === text
  const elsewhere = narrator.busy && !current
  return <div style={rowStyle}>
    {current ? <PlaybackButtons narrator={narrator} label={label} />
      : <button type="button" style={buttonStyle} disabled={!text.trim() || elsewhere} title={elsewhere ? 'Stop the current narration before listening to this.' : undefined}
        onClick={() => { beforeSpeak?.(); void narrator.speak(text) }}>{label}</button>}
  </div>
}

export default function NarrationControls({ narrator, beforeSpeak }: { narrator: Narrator; beforeSpeak?: () => void }) {
  const languages = Array.from(new Set([narrator.language, ...narrator.voices.map((voice) => voice.lang.replace(/_/g, '-'))])).sort()
  const matching = narrator.voices.filter((voice) => voice.lang.toLowerCase().split(/[-_]/)[0] === narrator.language.toLowerCase().split('-')[0])
  const preview = narrator.language.startsWith('de') ? 'Eine neue Geschichte beginnt. Hinter der Tür wartet eine kleine Überraschung.'
    : narrator.language.startsWith('it') ? 'Una nuova storia inizia. Dietro la porta ti aspetta una piccola sorpresa.'
      : 'A new story begins. Beyond the door, a small surprise is waiting.'
  const playingElsewhere = narrator.busy && narrator.activeText !== preview
  return <aside aria-label="Narration settings" style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #d9cfc5', borderRadius: 12, boxSizing: 'border-box', width: '100%', maxWidth: '100%', minWidth: 0, overflowWrap: 'anywhere' }}>
    <p style={{ marginTop: 0 }}><strong>Narration: {narrator.style}</strong> · {narrator.source}</p>
    <p>{narrator.provider === 'browser' ? 'Browser voices · no narration credits or new account needed.' : 'ElevenLabs mode · uses the configured provider voice; browser selection applies to fallback.'}</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 11rem), 1fr))', gap: '0.75rem 1rem', maxWidth: '100%', minWidth: 0 }}>
      <label style={fieldStyle}>Voice style <select style={selectStyle} value={narrator.styleOverride} onChange={(event) => narrator.setStyle(event.target.value as NarrationStyle | 'auto')}>
        <option value="auto">Auto (AI)</option>
        {NARRATION_STYLES.map((style) => <option key={style} value={style}>{style}</option>)}
      </select></label>
      <label style={fieldStyle}>Language <select style={selectStyle} value={narrator.languageOverride} onChange={(event) => narrator.setLanguage(event.target.value)}>
        <option value="">Story language (Auto: {narrator.languageOverride ? 'AI / legacy' : narrator.language})</option>
        {languages.map((language) => <option key={language} value={language}>{language}</option>)}
      </select></label>
      <label style={fieldStyle}>Browser voice <select style={selectStyle} value={matching.some((voice) => voiceKey(voice) === narrator.selectedVoice) ? narrator.selectedVoice : ''} onChange={(event) => narrator.setVoice(event.target.value)}>
        <option value="">Auto (language + style)</option>
        {matching.map((voice) => <option key={voiceKey(voice)} value={voiceKey(voice)}>{voice.name} · {voice.lang}{voice.localService ? ' · local' : ''}</option>)}
      </select></label>
    </div>
    <p>{NARRATION_PRESETS[narrator.style].description} Rate {NARRATION_PRESETS[narrator.style].rate} · pitch {NARRATION_PRESETS[narrator.style].pitch}. Actual browser voice: {narrator.voice ? `${narrator.voice.name} (${narrator.voice.lang})` : 'none available for this language'}.</p>
    <p>Styles adjust delivery; they do not install or create new OS voices. Your style, language and voice choices are remembered in this browser only.</p>
    {narrator.voiceNotice ? <p role="status">{narrator.voiceNotice}</p> : null}
    {narrator.preferenceNotice ? <p role="status">{narrator.preferenceNotice}</p> : null}
    {narrator.supported === false ? <p role="alert">Browser speech is unsupported here. You can still read the story.</p> : narrator.supported && !narrator.voices.length ? <p role="status">Waiting for browser voices. If none appear, check your OS speech settings or try another browser.</p> : null}
    <p>Preview: {preview}</p>
    <NarrationButton narrator={narrator} text={preview} label="Preview selected style" beforeSpeak={beforeSpeak} />
    {playingElsewhere ? <div style={rowStyle}><PlaybackButtons narrator={narrator} label="current story narration" /></div> : null}
    {narrator.error ? <p role="alert">{narrator.error}</p> : null}
    {narrator.notice ? <p role="status">{narrator.notice}</p> : null}
  </aside>
}
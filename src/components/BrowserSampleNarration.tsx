import { useNarration } from '../lib/useNarration'
import type { DemoPageCopy } from '../lib/demoPageLocalization'
import type { StoryLanguageCode } from '../lib/storyLanguage'

export default function BrowserSampleNarration({ label, language, text, copy }: {
  label: string
  language: StoryLanguageCode
  text: string
  copy: DemoPageCopy
}) {
  const narrator = useNarration({ narrationLanguage: language }, undefined, {}, { browserOnly: true })
  return <section aria-label={label} style={{ margin: '1rem 0' }}>
    <p>{copy.narrationNotice}</p>
    {narrator.busy ? <>
      <p role="status" aria-live="polite">{narrator.loading ? copy.narrationPreparing : narrator.paused ? copy.narrationPaused : copy.narrationSpeaking}</p>
      {narrator.paused
        ? <button type="button" onClick={narrator.resume}>{copy.narrationResume}</button>
        : narrator.canPause ? <button type="button" onClick={narrator.pause}>{copy.narrationPause}</button> : null}
      <button type="button" onClick={narrator.stop}>{copy.narrationStop}</button>
    </> : <button type="button" disabled={!text.trim() || narrator.supported === false}
      onClick={() => { void narrator.speak(text) }}>{label}</button>}
    {narrator.supported === false ? <p role="status">{copy.narrationUnavailable}</p> : null}
    {narrator.error ? <p role="alert">{copy.narrationError}</p> : null}
  </section>
}

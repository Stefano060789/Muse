import Link from 'next/link'
import { useEffect, useState } from 'react'
import { loadMuseProfile, saveMuseProfile } from '../lib/profile'
import { useStoryInteraction } from '../lib/useStoryInteraction'
import HoldToSpeakButton from './HoldToSpeakButton'
import { STORY_LANGUAGES, type StoryLanguageCode } from '../lib/storyLanguage'

export default function HomePersonalTouches() {
  const [about, setAbout] = useState('')
  const [language, setLanguage] = useState<StoryLanguageCode>('en-US')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const interaction = useStoryInteraction(undefined, language)
  useEffect(() => {
    try { setAbout(loadMuseProfile()?.about || '') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not read your personal touches.') }
  }, [])
  const save = () => {
    interaction.cancelRecording()
    setError(''); setNotice('')
    try {
      const profile = saveMuseProfile(about)
      setAbout(profile.about)
      setNotice('Saved. Your latest five memories will be included by default when you create a personal story.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your personal touches. Keep a copy of your text.')
    }
  }
  return <section className="atelier-card" aria-labelledby="about-you-title" style={{ marginTop: '2rem' }}>
    <h2 id="about-you-title">Tell Muse about yourself</h2>
    <p>People, places, interests, or what matters to you. Your latest five saved memories help shape new personal stories by default. You can leave them out before creating a story.</p>
    <p className="atelier-note">Saved only in this browser. Memories are sent to the story AI provider only when you consent to creating a story. Speaking may use an online speech-recognition service.</p>
    <label>Personal touches
      <textarea aria-label="About yourself" value={about} maxLength={4000} rows={4}
        onFocus={() => interaction.cancelRecording()}
        onChange={event => { interaction.cancelRecording(); setAbout(event.target.value) }}
        placeholder="I love quiet gardens, travelling, and discovering new places..."
        style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '1rem', font: 'inherit' }} />
    </label>
    <details style={{ marginTop: '0.75rem' }}>
      <summary>Voice input language</summary>
      <select aria-label="Personal touches voice language" value={language} onChange={event => { interaction.cancelRecording(); setLanguage(event.target.value as StoryLanguageCode) }}>
        {STORY_LANGUAGES.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
      </select>
    </details>
    <div className="atelier-actions">
      <HoldToSpeakButton label="Hold to speak about yourself" recording={Boolean(interaction.recordingTarget)}
        onStart={() => interaction.dictate('about', value => setAbout(value.slice(0, 4000)))}
        onStop={() => interaction.stopRecording('about')} />
      <button type="button" className="atelier-button" disabled={!about.trim()} onClick={save}>Save personal touches</button>
    </div>
    {interaction.recordingTarget ? <p role="status">{interaction.ready ? 'Listening - release when you are done.' : 'Starting microphone...'}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {error || interaction.error ? <p role="alert">{error || interaction.error}</p> : null}
    <Link href="/myself">Review or remove saved memories</Link>
  </section>
}

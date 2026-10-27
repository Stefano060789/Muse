import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { forgetMuseProfile, loadMuseProfile, replaceMuseProfileKeypoints, saveMuseProfile, saveMuseProfileReflection, type MuseProfile } from '../lib/profile'
import { useStoryInteraction } from '../lib/useStoryInteraction'
import DictationButton from '../components/DictationButton'
import { STORY_LANGUAGES, type StoryLanguageCode } from '../lib/storyLanguage'
import { loadStoryPreferences } from '../lib/storyPreferences'

const DISCOVERY_TOPICS = [
  'A small tradition that feels like home',
  'A time someone helped you see things differently',
  'Something you loved doing as a child',
  'A place that brings back a vivid memory',
  'A moment you felt proud of yourself',
  'A belief or value you have changed your mind about',
  'A kind gesture you still remember',
  'Something you hope to experience one day'
]

export default function MyselfPage() {
  const [about, setAbout] = useState('')
  const [keypoints, setKeypoints] = useState<string[]>([])
  const [topic, setTopic] = useState('')
  const [reflection, setReflection] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState<string[]>([])
  const [language, setLanguage] = useState<StoryLanguageCode>('en-US')
  const interaction = useStoryInteraction(undefined, language)
  const isAboutRecording = interaction.recordingTarget === 'about'
  const isTopicRecording = interaction.recordingTarget === 'topic'

  useEffect(() => {
    try {
      const profile = loadMuseProfile()
      if (profile) applyProfile(profile)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not read saved memories.')
    }
    try {
      const preferred = loadStoryPreferences().language
      if (preferred) setLanguage(preferred)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not read your saved story language.')
    }
  }, [])

  const applyProfile = (profile: MuseProfile) => {
    setAbout(profile.about)
    setKeypoints(profile.keypoints)
    setDrafts(profile.keypoints)
  }

  const save = () => {
    interaction.cancelRecording()
    setError('')
    setMessage('')
    if (!about.trim()) {
      setMessage('Add a little about yourself first.')
      return
    }
    try {
      const profile = saveMuseProfile(about)
      applyProfile(profile)
      setMessage('Saved in this browser.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save your memories. Keep a copy of your text.')
    }
  }

  const showTopic = () => {
    const options = DISCOVERY_TOPICS.filter(option => option !== topic)
    setTopic(options[Math.floor(Math.random() * options.length)])
    setReflection('')
    setMessage('')
    setError('')
    interaction.cancelRecording()
  }

  const saveReflection = () => {
    interaction.cancelRecording()
    setError('')
    setMessage('')
    try {
      const profile = saveMuseProfileReflection(topic, reflection)
      applyProfile(profile)
      setReflection('')
      setMessage('Your reflection was saved as an editable personal memory in this browser.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save this reflection. Your existing memories are unchanged.')
    }
  }

  const changeMemory = (index: number, remove = false) => {
    setError('')
    setMessage('')
    if (remove && !window.confirm('Remove this memory from your profile? Existing stories will not be changed.')) return
    try {
      const points = remove ? keypoints.filter((_, position) => position !== index) :
        keypoints.map((point, position) => position === index ? drafts[index] : point)
      applyProfile(replaceMuseProfileKeypoints(points))
      setMessage(remove ? 'Memory removed from this browser profile.' : 'Memory updated in this browser.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update this memory. Your saved profile is unchanged.')
    }
  }

  const forget = () => {
    if (!window.confirm('Forget all profile memories in this browser? Previously generated stories and details already sent to AI are not erased.')) return
    setError('')
    setMessage('')
    try {
      forgetMuseProfile()
      interaction.stopRecording()
      setAbout('')
      setKeypoints([])
      setDrafts([])
      setTopic('')
      setReflection('')
      setMessage('All profile memories were removed from this browser. Existing stories were not changed.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not remove your memories.')
    }
  }

  return (
    <>
      <Head><title>Muse — Myself</title><meta name="description" content="Tell Muse what matters to you so your stories feel personal." /></Head>
      <main className="atelier-page">
        <div className="atelier-shell atelier-shell--narrow">
          <p className="atelier-eyebrow">Personal touches · Optional</p>
          <h1 className="atelier-title">Myself</h1>
          <p className="atelier-subtitle">Tell Muse about yourself. Your latest five memories help shape new stories.</p>
          <p className="atelier-note">Saved only in this browser. Sent to AI only when you consent to creating a story; you can leave them out.</p>
          <section style={{ background: '#fffaf6', border: '1px solid #d9cfc5', borderRadius: 20, padding: '1.5rem', marginTop: '2rem' }}>
            <label style={{ display: 'block', fontWeight: 700 }}>About yourself
              <textarea aria-label="About yourself" value={about} maxLength={4000} onFocus={() => interaction.cancelRecording()} onChange={(event) => { interaction.cancelRecording(); setAbout(event.target.value) }} rows={5} placeholder="People, places, feelings, things you love…" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '0.7rem', padding: '1rem', font: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
            </label>
            <details style={{ marginTop: '0.75rem' }}>
              <summary>Voice input language</summary>
              <select aria-label="Personal touches voice language" value={language} onChange={event => {
                const selected = STORY_LANGUAGES.find(option => option.code === event.target.value)
                if (!selected) { setError('Choose a supported story language.'); return }
                interaction.cancelRecording()
                setLanguage(selected.code)
              }}>
                {STORY_LANGUAGES.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
              </select>
            </details>
            <p className="atelier-note">Speaking may use an online speech service. Review the text before saving.</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <button onClick={save} disabled={!about.trim()} style={{ border: 0, borderRadius: 999, background: '#2d2926', color: '#fffaf6', padding: '0.85rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>Save personal touches</button>
              <DictationButton recording={isAboutRecording} stopping={interaction.stoppingTarget === 'about'} stoppingLabel="Finishing dictation…" disabled={Boolean(interaction.stoppingTarget)} label="Start dictation" stopLabel="Stop and use transcript" onStart={() => { setMessage(''); interaction.dictate('about', value => setAbout(value.slice(0, 4000))) }} onStop={() => interaction.stopRecording('about')} style={{ padding: '0.85rem 1.1rem', cursor: 'pointer', background: isAboutRecording ? '#a14329' : undefined, color: isAboutRecording ? '#fffaf6' : undefined }} />
            </div>
            <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid #d9cfc5' }}>
              <h2 style={{ marginTop: 0 }}>Explore a topic</h2>
              <p>Choose a gentle conversation prompt, then write or speak about your own experience.</p>
              <button type="button" onClick={showTopic}>Show me a topic</button>
              {topic ? <>
                <p role="status" style={{ fontWeight: 700, lineHeight: 1.6 }}>{topic}</p>
                <label style={{ display: 'block', fontWeight: 700 }}>Your reflection
                  <textarea aria-label="Your reflection" value={reflection} maxLength={4000} onFocus={() => interaction.cancelRecording()} onChange={event => { interaction.cancelRecording(); setReflection(event.target.value) }} rows={4} placeholder="Take your time. Share only what you want to remember." style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '0.7rem', padding: '1rem', font: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                  <button type="button" onClick={saveReflection} disabled={!reflection.trim()}>Save this reflection to memories</button>
                  <DictationButton recording={isTopicRecording} stopping={interaction.stoppingTarget === 'topic'} stoppingLabel="Finishing dictation…" disabled={Boolean(interaction.stoppingTarget)} label="Speak about it" stopLabel="Stop and use transcript" onStart={() => { setMessage(''); interaction.dictate('topic', value => setReflection(value.slice(0, 4000))) }} onStop={() => interaction.stopRecording('topic')} style={{ padding: '0.85rem 1.1rem', cursor: 'pointer', background: isTopicRecording ? '#a14329' : undefined, color: isTopicRecording ? '#fffaf6' : undefined }} />
                </div>
                <p className="atelier-note">Saved reflections become short, editable memories tagged with this topic. They stay in this browser and are only sent with your consent when you create a personal story.</p>
              </> : null}
            </div>
            {message ? <p role="status" style={{ lineHeight: 1.6, marginBottom: 0 }}>{message}</p> : null}
            {error ? <p role="alert" style={{ color: '#a14329', lineHeight: 1.6 }}>{error}</p> : null}
            {interaction.error ? <p role="alert" style={{ color: '#a14329', lineHeight: 1.6 }}>{interaction.error}</p> : null}
            {isAboutRecording || isTopicRecording ? <p role="status">{interaction.ready ? 'Listening — release when you are done.' : 'Starting microphone…'}</p> : null}
          </section>
          <section style={{ marginTop: '1rem', padding: '1.25rem 1.5rem', border: '1px solid #d9cfc5', borderRadius: 18 }}>
            <h2 style={{ marginTop: 0 }}>Your memories</h2>
            {keypoints.length > 0 ? <ul style={{ lineHeight: 1.8, paddingLeft: '1.25rem' }}>{keypoints.map((keypoint, index) => <li key={keypoint} style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block' }}>Memory {index + 1}<input aria-label={`Memory ${index + 1}`} value={drafts[index] || ''} maxLength={180} onChange={(event) => setDrafts((current) => current.map((point, position) => position === index ? event.target.value : point))} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.65rem', font: 'inherit' }} /></label>
              <button onClick={() => changeMemory(index)} style={{ marginTop: '0.5rem', marginRight: '0.5rem' }}>Save memory {index + 1}</button>
              <button onClick={() => changeMemory(index, true)}>Remove memory {index + 1}</button>
            </li>)}</ul> : <p style={{ marginBottom: 0, opacity: 0.7 }}>No memories yet.</p>}
            <p>Removing memories does not erase existing stories or data already sent to AI.</p>
            <button onClick={forget}>Forget all memories</button>
          </section>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' }}>
            <Link href="/story?new=1" style={{ background: '#2d2926', color: '#fffaf6', borderRadius: 999, padding: '0.85rem 1.2rem', textDecoration: 'none', fontWeight: 700 }}>Create My Story →</Link>
            <Link href="/shared" style={{ color: '#2d2926', border: '1px solid #2d2926', borderRadius: 999, padding: '0.85rem 1.2rem', textDecoration: 'none' }}>Create a story for someone</Link>
          </div>
        </div>
      </main>
    </>
  )
}

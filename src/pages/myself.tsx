import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { forgetMuseProfile, loadMuseProfile, replaceMuseProfileKeypoints, saveMuseProfile, saveMuseProfileReflection, type MuseProfile } from '../lib/profile'
import { useStoryInteraction } from '../lib/useStoryInteraction'
import DictationButton from '../components/DictationButton'
import { STORY_LANGUAGES, type StoryLanguageCode } from '../lib/storyLanguage'
import { loadStoryPreferences } from '../lib/storyPreferences'
import { interfacePageText as text } from '../lib/interfacePages'
import { useInterfaceLanguage } from '../lib/interfaceLanguage'
import { interfaceFlowText } from '../lib/interfaceFlow'

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
  const interfaceLanguage = useInterfaceLanguage()
  const flow = (key: Parameters<typeof interfaceFlowText>[0]) => interfaceFlowText(key, interfaceLanguage)
  const direction = STORY_LANGUAGES.find(option => option.code === interfaceLanguage)?.dir
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
      setMessage(flow('saved'))
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
      setMessage(flow('saved'))
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
      setMessage(flow('saved'))
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
      setMessage(flow('saved'))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not remove your memories.')
    }
  }

  return (
    <>
      <Head><title>{`Muse — ${text('myselfTitle', interfaceLanguage)}`}</title><meta name="description" content={text('myselfSubtitle', interfaceLanguage)} /></Head>
      <main className="atelier-page" lang={interfaceLanguage} dir={direction}>
        <div className="atelier-shell atelier-shell--narrow">
          <p className="atelier-eyebrow">{text('myselfEyebrow', interfaceLanguage)}</p>
          <h1 className="atelier-title">{text('myselfTitle', interfaceLanguage)}</h1>
          <p className="atelier-note">{text('myselfPrivacy', interfaceLanguage)}</p>
          <section style={{ background: '#fffaf6', border: '1px solid #d9cfc5', borderRadius: 20, padding: '1.5rem', marginTop: '2rem' }}>
            <label style={{ display: 'block', fontWeight: 700 }}>{text('aboutYourself', interfaceLanguage)}
              <textarea aria-label={text('aboutYourself', interfaceLanguage)} value={about} maxLength={4000} onFocus={() => interaction.cancelRecording()} onChange={(event) => { interaction.cancelRecording(); setAbout(event.target.value) }} rows={5} placeholder={text('aboutPlaceholder', interfaceLanguage)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '0.7rem', padding: '1rem', font: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
            </label>
            <details style={{ marginTop: '0.75rem' }}>
              <summary>{text('voiceInputLanguage', interfaceLanguage)}</summary>
              <select aria-label={text('voiceInputLanguage', interfaceLanguage)} value={language} onChange={event => {
                const selected = STORY_LANGUAGES.find(option => option.code === event.target.value)
                if (!selected) { setError('Choose a supported story language.'); return }
                interaction.cancelRecording()
                setLanguage(selected.code)
              }}>
                {STORY_LANGUAGES.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
              </select>
            </details>
            <p className="atelier-note">{text('speechPrivacy', interfaceLanguage)}</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <button onClick={save} disabled={!about.trim()} style={{ border: 0, borderRadius: 999, background: '#2d2926', color: '#fffaf6', padding: '0.85rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>{text('savePersonalTouches', interfaceLanguage)}</button>
              <DictationButton recording={isAboutRecording} stopping={interaction.stoppingTarget === 'about'} stoppingLabel={flow('finishing')} disabled={Boolean(interaction.stoppingTarget)} label={flow('dictate')} stopLabel={flow('stopUseText')} onStart={() => { setMessage(''); interaction.dictate('about', value => setAbout(value.slice(0, 4000))) }} onStop={() => interaction.stopRecording('about')} style={{ padding: '0.85rem 1.1rem', cursor: 'pointer', background: isAboutRecording ? '#a14329' : undefined, color: isAboutRecording ? '#fffaf6' : undefined }} />
            </div>
            <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid #d9cfc5' }}>
              <h2 style={{ marginTop: 0 }}>{text('exploreTopic', interfaceLanguage)}</h2>
              <button type="button" onClick={showTopic}>{text('showTopic', interfaceLanguage)}</button>
              {topic ? <>
                <p role="status" style={{ fontWeight: 700, lineHeight: 1.6 }}>{topic}</p>
                <label style={{ display: 'block', fontWeight: 700 }}>{text('yourReflection', interfaceLanguage)}
                  <textarea aria-label={text('yourReflection', interfaceLanguage)} value={reflection} maxLength={4000} onFocus={() => interaction.cancelRecording()} onChange={event => { interaction.cancelRecording(); setReflection(event.target.value) }} rows={4} placeholder={text('reflectionPlaceholder', interfaceLanguage)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '0.7rem', padding: '1rem', font: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                  <button type="button" onClick={saveReflection} disabled={!reflection.trim()}>{text('saveReflection', interfaceLanguage)}</button>
                  <DictationButton recording={isTopicRecording} stopping={interaction.stoppingTarget === 'topic'} stoppingLabel={flow('finishing')} disabled={Boolean(interaction.stoppingTarget)} label={`${flow('dictate')} · ${text('yourReflection', interfaceLanguage)}`} stopLabel={flow('stopUseText')} onStart={() => { setMessage(''); interaction.dictate('topic', value => setReflection(value.slice(0, 4000))) }} onStop={() => interaction.stopRecording('topic')} style={{ padding: '0.85rem 1.1rem', cursor: 'pointer', background: isTopicRecording ? '#a14329' : undefined, color: isTopicRecording ? '#fffaf6' : undefined }} />
                </div>
              </> : null}
            </div>
            {message ? <p role="status" style={{ lineHeight: 1.6, marginBottom: 0 }}>{message}</p> : null}
            {error ? <p role="alert" style={{ color: '#a14329', lineHeight: 1.6 }}>{error}</p> : null}
            {interaction.error ? <p role="alert" style={{ color: '#a14329', lineHeight: 1.6 }}>{interaction.error}</p> : null}
            {isAboutRecording || isTopicRecording ? <p role="status">{interaction.ready ? flow('listen') : flow('startingMic')}</p> : null}
          </section>
          <section style={{ marginTop: '1rem', padding: '1.25rem 1.5rem', border: '1px solid #d9cfc5', borderRadius: 18 }}>
            <h2 style={{ marginTop: 0 }}>{text('yourMemories', interfaceLanguage)}</h2>
            {keypoints.length > 0 ? <ul style={{ lineHeight: 1.8, paddingLeft: '1.25rem' }}>{keypoints.map((keypoint, index) => <li key={keypoint} style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block' }}>{text('memory', interfaceLanguage)} {index + 1}<input aria-label={`${text('memory', interfaceLanguage)} ${index + 1}`} value={drafts[index] || ''} maxLength={180} onChange={(event) => setDrafts((current) => current.map((point, position) => position === index ? event.target.value : point))} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.65rem', font: 'inherit' }} /></label>
              <button onClick={() => changeMemory(index)} style={{ marginTop: '0.5rem', marginRight: '0.5rem' }}>{text('saveMemory', interfaceLanguage)} {index + 1}</button>
              <button onClick={() => changeMemory(index, true)}>{text('removeMemory', interfaceLanguage)} {index + 1}</button>
            </li>)}</ul> : <p style={{ marginBottom: 0, opacity: 0.7 }}>{text('noMemories', interfaceLanguage)}</p>}
            <p>{flow('memoryDeletionNote')}</p>
            <button onClick={forget}>{text('forgetMemories', interfaceLanguage)}</button>
          </section>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' }}>
            <Link href="/story?new=1" style={{ background: '#2d2926', color: '#fffaf6', borderRadius: 999, padding: '0.85rem 1.2rem', textDecoration: 'none', fontWeight: 700 }}>{text('createMyStory', interfaceLanguage)}</Link>
            <Link href="/shared" style={{ color: '#2d2926', border: '1px solid #2d2926', borderRadius: 999, padding: '0.85rem 1.2rem', textDecoration: 'none' }}>{text('createGiftStory', interfaceLanguage)}</Link>
          </div>
        </div>
      </main>
    </>
  )
}

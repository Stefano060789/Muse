import { useEffect, useMemo, useRef, useState } from 'react'
import type { PersonalStory } from '../lib/story'
import type { StoryLanguageCode } from '../lib/storyLanguage'
import { storyLanguage } from '../lib/storyLanguage'
import { accountFetch } from '../lib/accountClient'
import { storyReelCopy } from '../lib/storyReelCopy'
import { createStoryMomentSvg, type ShareCardTheme } from '../lib/personalStoryShareVisual'
import { createStoryReelClip } from '../lib/storyReelMotion'
import { moodMusicTrack } from '../lib/moodMusic'
import { PROVIDER_CONSENT_VERSION } from '../lib/providerConsent'
import type { StoryReelMoment } from '../lib/storyReelLogic'
import { suggestStoryMotif } from '../lib/storyShareArtwork'
import HeygenStoryReel from './HeygenStoryReel'

type ReelStory = Pick<PersonalStory, 'id' | 'title' | 'mood' | 'language' | 'scenes' | 'currentStep'>

type EditableMoment = StoryReelMoment & { enabled: boolean }

type PlanResponse = {
  moments: StoryReelMoment[]
  source: 'ai' | 'fallback'
  provider: { enabled: boolean; provider: string; reason: string; estimatedAiAttemptsPerImage: number; userDailyCap: number }
  premium: { available: boolean; message: string }
}

const THEME_OPTIONS: ShareCardTheme[] = ['starlight', 'paper', 'dawn']

function reelSource(story: ReelStory, language: StoryLanguageCode) {
  return {
    title: story.title,
    mood: story.mood,
    language: story.language || language,
    currentStep: story.currentStep,
    scenes: story.scenes.slice(0, story.currentStep + 1).map(scene => ({
      title: scene.title,
      body: scene.body,
      ...(scene.sceneMood ? { sceneMood: scene.sceneMood } : {})
    }))
  }
}

function fallbackMomentImage(story: ReelStory, moment: EditableMoment, index: number, total: number, theme: ShareCardTheme, language: StoryLanguageCode) {
  const motif = suggestStoryMotif(story.title, `${moment.caption} ${moment.prompt}`)
  const svg = createStoryMomentSvg({
    title: story.title,
    passage: moment.caption,
    reflection: '',
    milestone: 'Story reel moment',
    progress: `${index + 1}/${total}`,
    theme,
    format: 'story',
    rtl: storyLanguage(story.language || language).dir === 'rtl',
    motif
  })
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function storyMoodToSceneMood(story: ReelStory): unknown {
  const latestSceneMood = story.scenes[Math.max(0, story.currentStep)]?.sceneMood
  if (latestSceneMood) return latestSceneMood
  if (story.mood === 'adventure') return 'adventure'
  if (story.mood === 'curious') return 'mystery'
  if (story.mood === 'hopeful') return 'joy'
  return 'reflection'
}

export default function StoryReelComposer({ story, interfaceLanguage }: {
  story: ReelStory
  interfaceLanguage: StoryLanguageCode
}) {
  return <>
    <HeygenStoryReel story={story} interfaceLanguage={interfaceLanguage} />
    <details><summary>Other reel options</summary>
      <LocalStoryReelComposer story={story} interfaceLanguage={interfaceLanguage} />
    </details>
  </>
}

function LocalStoryReelComposer({ story, interfaceLanguage }: {
  story: ReelStory
  interfaceLanguage: StoryLanguageCode
}) {
  const copy = storyReelCopy(interfaceLanguage)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [provider, setProvider] = useState<PlanResponse['provider'] | null>(null)
  const [premiumMessage, setPremiumMessage] = useState('')
  const [moments, setMoments] = useState<EditableMoment[]>([])
  const [theme, setTheme] = useState<ShareCardTheme>('starlight')
  const [reviewed, setReviewed] = useState(false)
  const [providerConsent, setProviderConsent] = useState(false)
  const [narration, setNarration] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null)
  const [clipViewed, setClipViewed] = useState(false)
  const renderOperation = useRef<AbortController | null>(null)
  const clipUrl = useRef<string | null>(null)

  useEffect(() => () => {
    renderOperation.current?.abort()
    if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
  }, [])

  const activeMoments = useMemo(() => moments.filter(moment => moment.enabled), [moments])

  const loadPlan = async () => {
    setLoading(true)
    setMessage('')
    setFailed(false)
    try {
      const response = await accountFetch('/api/personal-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'story-reel-plan', consentVersion: PROVIDER_CONSENT_VERSION, ...reelSource(story, interfaceLanguage) })
      })
      const data = await response.json() as PlanResponse & { error?: string }
      if (!response.ok) throw new Error(data.error || copy.error)
      if (!Array.isArray(data.moments) || !data.provider || !data.premium) throw new Error(copy.error)
      setMoments(data.moments.map(moment => ({ ...moment, enabled: true })))
      setProvider(data.provider)
      setPremiumMessage(data.premium.message)
      if (data.source === 'fallback') setMessage(copy.fallback)
      setReviewed(false)
      setProviderConsent(false)
      if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
      clipUrl.current = null
      setClip(null)
      setClipViewed(false)
    } catch (error) {
      setFailed(true)
      setMessage(error instanceof Error ? error.message : copy.error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && !moments.length && !loading) void loadPlan()
  }, [open])

  const cancelRender = () => {
    renderOperation.current?.abort()
    renderOperation.current = null
    setBusy(false)
    setFailed(false)
    setMessage(copy.cancel)
  }

  const createClip = async () => {
    if (!reviewed) return
    if (!activeMoments.length) {
      setFailed(true)
      setMessage(copy.noMoments)
      return
    }
    if (!provider) return
    if (provider.enabled && !providerConsent) {
      setFailed(true)
      setMessage(copy.providerDisclosure)
      return
    }

    const operation = new AbortController()
    renderOperation.current = operation
    setBusy(true)
    setProgress(0)
    setFailed(false)
    setMessage('')

    try {
      let images: Array<{ id: string; dataUrl: string }> = activeMoments.map((moment, index) => ({
        id: moment.id,
        dataUrl: fallbackMomentImage(story, moment, index, activeMoments.length, theme, interfaceLanguage)
      }))

      if (provider.enabled) {
        const response = await accountFetch('/api/personal-story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: operation.signal,
          body: JSON.stringify({
            action: 'story-reel-images',
            approved: true,
            consentVersion: PROVIDER_CONSENT_VERSION,
            theme,
            moments: activeMoments.map(moment => ({ id: moment.id, scene: moment.scene, caption: moment.caption, prompt: moment.prompt })),
            ...reelSource(story, interfaceLanguage)
          })
        })
        const data = await response.json() as { images?: Array<{ id: string; dataUrl: string }>; error?: string }
        if (!response.ok) throw new Error(data.error || copy.error)
        if (Array.isArray(data.images) && data.images.length) images = data.images
      }

      const moodTrack = moodMusicTrack(storyMoodToSceneMood(story))
      const shareUrl = typeof window === 'undefined' ? 'https://muse.example' : `${window.location.origin}/?utm_source=story-reel`
      const blob = await createStoryReelClip({
        moments: activeMoments.map((moment, index) => {
          const image = images.find(entry => entry.id === moment.id)
          return { id: moment.id, caption: moment.caption, image: image?.dataUrl || fallbackMomentImage(story, moment, index, activeMoments.length, theme, interfaceLanguage) }
        }),
        theme,
        shareUrl,
        moodTrack,
        narration: narration || undefined,
        signal: operation.signal,
        onProgress: setProgress
      })
      if (operation.signal.aborted) return
      const url = URL.createObjectURL(blob)
      if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
      clipUrl.current = url
      setClip({ blob, url })
      setClipViewed(false)
      if (/cc\s*by/iu.test(moodTrack?.license || '') && moodTrack?.attribution) {
        setMessage(`${copy.attributionPrefix} ${moodTrack.attribution}`)
      } else {
        setMessage(copy.ready)
      }
    } catch (error) {
      if (!operation.signal.aborted) {
        setFailed(true)
        setMessage(error instanceof Error ? error.message : copy.error)
      }
    } finally {
      if (renderOperation.current === operation) renderOperation.current = null
      setBusy(false)
    }
  }

  const clipFile = clip ? new File([clip.blob], `muse-story-reel.${clip.blob.type.startsWith('video/mp4') ? 'mp4' : 'webm'}`, { type: clip.blob.type }) : null

  const download = () => {
    if (!clip || !clipViewed) return
    const link = document.createElement('a')
    link.href = clip.url
    link.download = clipFile?.name || 'muse-story-reel.mp4'
    document.body.append(link)
    link.click()
    link.remove()
  }

  const share = async () => {
    if (!clip || !clipViewed || !clipFile) return
    try {
      if (!navigator.share || !navigator.canShare?.({ files: [clipFile] })) {
        setFailed(true)
        setMessage(copy.shareUnsupported)
        return
      }
      await navigator.share({ title: story.title, files: [clipFile] })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setFailed(true)
      setMessage(copy.error)
    }
  }

  return <section className="story-reel" aria-label={copy.open}>
    <button type="button" className="atelier-button" aria-expanded={open} onClick={() => setOpen(value => !value)}>{copy.open}</button>
    {open ? <div className="story-reel-panel">
      <h3>{copy.intro}</h3>
      {loading ? <p role="status">{copy.loading}</p> : null}
      {!loading && moments.length ? <>
        <fieldset className="story-reel-group">
          <legend>{copy.moments}</legend>
          <div className="story-reel-moments">
            {moments.map((moment, index) => <article key={moment.id} className="story-reel-moment">
              <label>
                <input type="checkbox" checked={moment.enabled} onChange={event => {
                  setMoments(current => current.map(entry => entry.id === moment.id ? { ...entry, enabled: event.target.checked } : entry))
                  setReviewed(false)
                }} /> {copy.includeMoment} #{index + 1}
              </label>
              <label>{copy.caption}
                <textarea rows={2} maxLength={120} value={moment.caption} onChange={event => {
                  const value = event.target.value
                  setMoments(current => current.map(entry => entry.id === moment.id ? { ...entry, caption: value } : entry))
                  setReviewed(false)
                }} />
              </label>
              <details>
                <summary>{copy.prompt}</summary>
                <p>{moment.prompt}</p>
              </details>
            </article>)}
          </div>
        </fieldset>
        <fieldset className="share-studio-picker">
          <legend>{copy.theme}</legend>
          {THEME_OPTIONS.map(option => <button key={option} type="button" aria-pressed={theme === option} onClick={() => {
            setTheme(option)
            setReviewed(false)
          }}>{option}</button>)}
        </fieldset>
        <label className="story-reel-audio">{copy.narration}
          <input type="file" accept="audio/*" onChange={event => {
            setNarration(event.target.files?.[0] || null)
            setReviewed(false)
          }} />
          <small>{copy.narrationHint}</small>
        </label>
        {provider ? <section className="story-reel-provider">
          {provider.enabled ? <>
            <p><strong>{copy.providerEstimate}:</strong> {activeMoments.length} images · {activeMoments.length * provider.estimatedAiAttemptsPerImage} AI attempts · {provider.userDailyCap} daily user cap</p>
            <p>{copy.providerDisclosure}</p>
            <label><input type="checkbox" checked={providerConsent} onChange={event => {
              setProviderConsent(event.target.checked)
              setReviewed(false)
            }} /> {copy.providerConsent}</label>
          </> : <p>{copy.providerDisabled}</p>}
        </section> : null}
        <section className="runway-share" aria-label={copy.premiumTitle}>
          <h4>{copy.premiumTitle}</h4>
          <p role="status">{premiumMessage || copy.premiumDisabled}</p>
        </section>
        <label className="story-reel-reviewed"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /> {copy.reviewed}</label>
        <div className="atelier-actions">
          <button type="button" className="atelier-button" disabled={!reviewed || busy || !activeMoments.length} onClick={() => void createClip()}>{busy ? copy.rendering : copy.render}</button>
          {busy ? <button type="button" className="atelier-secondary" onClick={cancelRender}>{copy.cancel}</button> : null}
        </div>
      </> : null}
      {busy ? <div role="status"><progress max={100} value={progress} /> {progress}%</div> : null}
      {clip ? <section className="story-reel-preview">
        <video className="share-studio-video" src={clip.url} controls playsInline loop onPlay={() => setClipViewed(true)} aria-label={copy.videoLabel} />
        <p>{clip.blob.type.startsWith('video/mp4') ? copy.mp4Preferred : copy.webmNote}</p>
        <div className="atelier-actions">
          <button type="button" className="atelier-button" disabled={!clipViewed} onClick={download}>{copy.download}</button>
          <button type="button" className="atelier-secondary" disabled={!clipViewed} onClick={() => void share()}>{copy.share}</button>
        </div>
      </section> : null}
      {message ? <p role={failed ? 'alert' : 'status'}>{message}</p> : null}
    </div> : null}
  </section>
}

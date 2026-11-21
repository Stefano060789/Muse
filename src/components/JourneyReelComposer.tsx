import { useEffect, useMemo, useRef, useState } from 'react'
import { personalStoryShareText } from '../lib/personalStoryShareCopy'
import { journeyReelCopy } from '../lib/journeyReelCopy'
import { createJourneyReelClip } from '../lib/journeyReelMotion'
import {
  JOURNEY_REEL_CHOICE_LIMIT,
  applyJourneyReelVisibility,
  journeyReelConsentRequired,
  planJourneyReelDraft,
  type JourneyReelDraftCard
} from '../lib/journeyReelPlan'
import { moodMusicTrack } from '../lib/moodMusic'
import type { SceneMood } from '../lib/sceneMood'
import type { PersonalStory } from '../lib/story'
import { storyLanguage, type StoryLanguageCode } from '../lib/storyLanguage'
import { shareVideoType } from '../lib/storyShareMotion'

export default function JourneyReelComposer({
  story,
  interfaceLanguage
}: {
  story: Pick<PersonalStory, 'title' | 'mood' | 'language' | 'scenes' | 'responses' | 'currentStep' | 'journey'>
  interfaceLanguage: StoryLanguageCode
}) {
  const completed = story.journey ? story.journey.status === 'concluded'
    : story.responses.length >= story.scenes.length || story.currentStep >= story.scenes.length - 1
  if (!completed) return null

  const copy = journeyReelCopy(interfaceLanguage)
  const contentLanguage = story.language ?? interfaceLanguage
  const contentDirection = storyLanguage(contentLanguage).dir
  const [expanded, setExpanded] = useState(false)
  const [cards, setCards] = useState<JourneyReelDraftCard[]>([])
  const [primaryMood, setPrimaryMood] = useState<SceneMood>('reflection')
  const [showChoices, setShowChoices] = useState(true)
  const [choiceConsent, setChoiceConsent] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [progress, setProgress] = useState(0)
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const operation = useRef<AbortController | null>(null)
  const clipUrl = useRef<string | null>(null)

  const resetClip = () => {
    operation.current?.abort()
    operation.current = null
    if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
    clipUrl.current = null
    setClip(null)
    setDuration(null)
    setRendering(false)
    setProgress(0)
  }

  useEffect(() => () => {
    resetClip()
  }, [])

  const prepare = () => {
    resetClip()
    const draft = planJourneyReelDraft(story)
    setCards(draft.cards)
    setPrimaryMood(draft.primaryMood)
    setShowChoices(draft.defaultShowChoices)
    setChoiceConsent(false)
    setMessage('')
    setFailed(false)
  }

  const visibleCards = useMemo(() => applyJourneyReelVisibility(cards, showChoices), [cards, showChoices])
  const needsConsent = journeyReelConsentRequired(cards, showChoices)

  const shareUrl = () => typeof window === 'undefined'
    ? 'https://muse.example'
    : `${window.location.origin}/?utm_source=journey-reel`

  const renderReel = async () => {
    if (operation.current) return
    if (!visibleCards.length) {
      setFailed(true)
      setMessage(copy.noCards)
      return
    }
    if (needsConsent && !choiceConsent) {
      setFailed(true)
      setMessage(copy.consent)
      return
    }
    if (!shareVideoType()) {
      setFailed(true)
      setMessage(copy.unsupported)
      return
    }
    const soundtrack = moodMusicTrack(primaryMood)
    const attributionLine = soundtrack && /cc\s*by/i.test(soundtrack.license)
      ? `${copy.soundtrackPrefix}: ${soundtrack.attribution}`
      : undefined
    const task = new AbortController()
    operation.current = task
    setRendering(true)
    setProgress(0)
    setMessage('')
    setFailed(false)
    try {
      const blob = await createJourneyReelClip({
        title: story.title,
        titleSubtitle: copy.title,
        cards: visibleCards,
        primaryMood,
        endingTitle: copy.endingTitle,
        shareLine: `${personalStoryShareText('shareTextFooter', interfaceLanguage)} ${shareUrl()}`,
        choicePrefix: copy.chosePrefix,
        rtl: contentDirection === 'rtl',
        soundtrack,
        attributionLine,
        signal: task.signal,
        onProgress: setProgress
      })
      if (task.signal.aborted) return
      const url = URL.createObjectURL(blob)
      if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
      clipUrl.current = url
      setClip({ blob, url })
      setMessage(copy.ready)
      setFailed(false)
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') {
        setFailed(false)
        setMessage(copy.cancelled)
      } else {
        setFailed(true)
        setMessage(copy.error)
      }
    } finally {
      if (operation.current === task) operation.current = null
      setRendering(false)
    }
  }

  const clipFile = (blob: Blob) => new File([blob], `muse-journey-reel.${blob.type.startsWith('video/mp4') ? 'mp4' : 'webm'}`, { type: blob.type })

  const downloadClip = () => {
    if (!clip) return
    try {
      const link = document.createElement('a')
      link.href = clip.url
      link.download = clipFile(clip.blob).name
      document.body.append(link)
      link.click()
      link.remove()
      setFailed(false)
      setMessage(copy.downloaded)
    } catch {
      setFailed(true)
      setMessage(copy.error)
    }
  }

  const shareClip = async () => {
    if (!clip) return
    const file = clipFile(clip.blob)
    try {
      if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
        setFailed(true)
        setMessage(copy.fileUnsupported)
        return
      }
      await navigator.share({ title: story.title, files: [file] })
      setFailed(false)
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setFailed(true)
      setMessage(copy.error)
    }
  }

  const type = shareVideoType()

  return <section aria-label={copy.title} className="story-share">
    <button type="button" className="atelier-button" aria-expanded={expanded} onClick={() => {
      if (!expanded) prepare()
      if (expanded) resetClip()
      setExpanded(value => !value)
    }}>{copy.title}</button>
    {expanded ? <div className="share-studio">
      <header className="share-studio-intro">
        <p className="atelier-eyebrow">Muse</p>
        <h3>{copy.title}</h3>
        <p>{copy.intro}</p>
        <p>{copy.privacy}</p>
      </header>
      <label className="atelier-field" style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
        <input type="checkbox" checked={showChoices} onChange={event => {
          setShowChoices(event.target.checked)
          if (!event.target.checked) setChoiceConsent(false)
        }} />
        <span>{copy.showChoices}<br /><small>{copy.showChoicesHint}</small></span>
      </label>
      <div style={{ display: 'grid', gap: '0.85rem' }}>
        {cards.map((card, index) => <article key={card.id} className="atelier-card" style={{ padding: '0.85rem 1rem' }}>
          <p style={{ margin: 0, opacity: 0.72 }}>{copy.sceneFallback.replace('{number}', String(card.sceneNumber))}</p>
          <p style={{ margin: '0.35rem 0 0.6rem', fontWeight: 600 }}>{card.title}</p>
          <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', marginBottom: '0.65rem' }}>
            <input type="checkbox" checked={!card.hidden} onChange={event => {
              const hidden = !event.target.checked
              setCards(current => current.map((entry, cardIndex) => cardIndex === index ? { ...entry, hidden } : entry))
            }} />
            <span>{copy.includeCard}</span>
          </label>
          {card.responseKind === 'none' ? <p style={{ margin: 0, opacity: 0.72 }}>{copy.hideChoiceEditor}</p> : <label className="atelier-field">{copy.choiceLabel}
            <textarea dir={contentDirection} lang={contentLanguage} rows={3} maxLength={JOURNEY_REEL_CHOICE_LIMIT}
              value={card.choiceText}
              onChange={event => setCards(current => current.map((entry, cardIndex) => cardIndex === index
                ? { ...entry, choiceText: event.target.value }
                : entry))} />
          </label>}
        </article>)}
      </div>
      {needsConsent ? <label style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
        <input type="checkbox" checked={choiceConsent} onChange={event => setChoiceConsent(event.target.checked)} />
        <span>{copy.consent}</span>
      </label> : null}
      {!type ? <p role="alert">{copy.unsupported}</p> : null}
      <div className="atelier-actions">
        <button type="button" className="atelier-button" disabled={rendering || !type || (needsConsent && !choiceConsent)} onClick={() => void renderReel()}>{rendering ? copy.rendering : copy.render}</button>
      </div>
      {rendering ? <div role="status">
        <p>{copy.progress} · {progress}%</p>
        <progress value={progress} max={100} aria-label={copy.progress} />
        <button type="button" onClick={() => operation.current?.abort()}>{copy.cancel}</button>
      </div> : null}
      {clip ? <section className="share-studio-review" aria-label={copy.preview}>
        <h4>{copy.preview}</h4>
        <video className="share-studio-video" src={clip.url} controls playsInline preload="metadata" style={{ width: 'min(100%, 520px)' }}
          onLoadedMetadata={event => {
            const value = event.currentTarget.duration
            setDuration(Number.isFinite(value) ? value : null)
          }}
          onError={() => {
            setFailed(true)
            setMessage(copy.error)
            resetClip()
          }} />
        <p>{clip.blob.type.startsWith('video/mp4') ? 'MP4' : 'WebM'}{duration !== null ? ` · ${duration.toFixed(1)} s` : ''} · 1080 × 1920</p>
        {!clip.blob.type.startsWith('video/mp4') ? <p role="alert">{copy.webmNote}</p> : null}
        <div className="atelier-actions">
          <button type="button" className="atelier-button" onClick={downloadClip}>{copy.download}</button>
          <button type="button" className="atelier-secondary" onClick={() => void shareClip()}>{copy.share}</button>
        </div>
      </section> : null}
      {message ? <p role={failed ? 'alert' : 'status'}>{message}</p> : null}
    </div> : null}
  </section>
}

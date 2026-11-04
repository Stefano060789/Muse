import { useEffect, useRef, useState } from 'react'
import { accountFetch } from '../lib/accountClient'
import { personalStoryShareText, personalStoryMoodText } from '../lib/personalStoryShareCopy'
import { createStoryMomentSvg, suggestStoryMoment, SHARE_CARD_SIZES, type ShareCardFormat, type ShareCardTheme } from '../lib/personalStoryShareVisual'
import { createShareClip, shareVideoType } from '../lib/storyShareMotion'
import { shareMotionCopy } from '../lib/shareMotionCopy'
import { PROVIDER_CONSENT_VERSION } from '../lib/providerConsent'
import type { PersonalStory } from '../lib/story'
import type { StoryLanguageCode } from '../lib/storyLanguage'
import { useShareConsent } from '../lib/useShareConsent'
import { shareConsentCopy } from '../lib/shareConsentCopy'
import { useAccountPermissions } from '../lib/useAccountPermissions'
import { registrationCopy } from '../lib/registrationCopy'
import { shareStudioCopy } from '../lib/shareStudioCopy'
import { storyLanguage } from '../lib/storyLanguage'
import RunwayStoryShare from './RunwayStoryShare'
import { STORY_MOTIFS, suggestStoryMotif, type StoryMotif } from '../lib/storyShareArtwork'
import { storyArtworkCopy } from '../lib/storyArtworkCopy'

export default function PersonalStoryShareCard({
  story,
  interfaceLanguage
}: {
  story: Pick<PersonalStory, 'title' | 'mood' | 'language' | 'scenes' | 'chapter' | 'journey' | 'responses' | 'generation' | 'currentStep'>
  interfaceLanguage: StoryLanguageCode
}) {
  const consent = useShareConsent()
  const permissions = useAccountPermissions()
  const permissionCopy = shareConsentCopy(interfaceLanguage)
  const [teaser, setTeaser] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [theme, setTheme] = useState<ShareCardTheme>('starlight')
  const [motif, setMotif] = useState<StoryMotif>('light')
  const [format, setFormat] = useState<ShareCardFormat>('story')
  const [passage, setPassage] = useState('')
  const [reflection, setReflection] = useState('')
  const [selectedScene, setSelectedScene] = useState('')
  const [exporting, setExporting] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null)
  const [clipBusy, setClipBusy] = useState(false)
  const [clipProgress, setClipProgress] = useState(0)
  const [clipViewed, setClipViewed] = useState(false)
  const [clipDuration, setClipDuration] = useState<number | null>(null)
  const [highlightRevision, setHighlightRevision] = useState(0)
  const clipOperation = useRef<AbortController | null>(null)
  const clipUrl = useRef<string | null>(null)
  const prepared = useRef(false)
  useEffect(() => () => {
    clipOperation.current?.abort()
    clipOperation.current = null
    if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
  }, [])
  const studio = shareStudioCopy(interfaceLanguage)
  const motion = shareMotionCopy(interfaceLanguage)
  const artwork = storyArtworkCopy(interfaceLanguage)
  const language = story.language ?? interfaceLanguage
  const mood = personalStoryMoodText(story.mood, language)
  const copy = (key: Parameters<typeof personalStoryShareText>[0]) => personalStoryShareText(key, interfaceLanguage)
  const completed = story.journey ? story.journey.status === 'concluded'
    : story.responses.length >= story.scenes.length ||
      (story.generation === 'ai' && story.currentStep === story.scenes.length - 1)
  const savedScenes = story.scenes.slice(0, story.currentStep + 1)
  const milestone = completed ? studio.complete : studio.active
  const progress = `${studio.chapter.replace('{number}', String(story.chapter?.number ?? 1))} · ${studio.scenes.replace('{number}', String(savedScenes.length))}`
  const cardSvg = createStoryMomentSvg({
    title: story.title, passage, reflection, milestone, progress, theme, format, motif,
    rtl: storyLanguage(language).dir === 'rtl'
  })
  useEffect(() => {
    clearClip()
  }, [cardSvg])

  const requestTeaser = async () => {
    setBusy(true)
    setMessage('')
    setFailed(false)
    try {
      if (!await consent.verify()) {
        setFailed(true)
        setMessage(permissionCopy.error)
        return
      }
      const response = await accountFetch('/api/personal-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'share-teaser',
          title: story.title,
          mood: story.mood,
          language,
          consentVersion: PROVIDER_CONSENT_VERSION
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not create the share teaser.')
      if (typeof data.teaser !== 'string') throw new Error('The server returned an invalid share teaser.')
      setTeaser(data.teaser)
      setMessage(copy('shareReady'))
    } catch (cause) {
      setFailed(true)
      setMessage(cause instanceof Error ? cause.message : copy('shareError'))
    } finally {
      setBusy(false)
    }
  }

  const shareUrl = () => `${window.location.origin}/?utm_source=personal-story-share`
  const shareText = () => [milestone, story.title, passage, reflection, progress, `${copy('shareTextFooter')} ${shareUrl()}`].filter(Boolean).join('\n\n')

  const clearClip = () => {
    clipOperation.current?.abort()
    clipOperation.current = null
    if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
    clipUrl.current = null
    setClip(null)
    setClipViewed(false)
    setClipDuration(null)
    setClipBusy(false)
  }

  const prepareHighlight = () => {
    clearClip()
    const suggested = suggestStoryMoment(savedScenes, story.mood)
    setSelectedScene(suggested.scene)
    setPassage(suggested.passage)
    setTheme(suggested.theme)
    setMotif(suggestStoryMotif(story.title, suggested.passage))
    setFormat('story')
    setReflection('')
    setMessage('')
    setFailed(false)
    setReviewing(true)
    setHighlightRevision(value => value + 1)
    prepared.current = true
  }

  const createClip = async () => {
    if (clipOperation.current) return
    setMessage('')
    setFailed(false)
    if (!shareVideoType()) { setFailed(true); setMessage(motion.unsupported); return }
    const operation = new AbortController()
    clipOperation.current = operation
    setClipBusy(true)
    setClipProgress(0)
    try {
      const blob = await createShareClip({ svg: cardSvg, format, theme, motif, signal: operation.signal, onProgress: setClipProgress })
      if (operation.signal.aborted) return
      const url = URL.createObjectURL(blob)
      if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
      clipUrl.current = url
      setClip({ blob, url })
      setClipViewed(false)
    } catch {
      if (!operation.signal.aborted) { setFailed(true); setMessage(motion.error) }
    } finally {
      if (clipOperation.current === operation) { clipOperation.current = null; setClipBusy(false) }
    }
  }

  useEffect(() => {
    if (expanded && reviewing && shareVideoType()) void createClip()
  }, [expanded, reviewing, cardSvg, highlightRevision])

  const clipFile = (blob: Blob) => new File([blob], `muse-story-highlight.${blob.type.startsWith('video/mp4') ? 'mp4' : 'webm'}`, { type: blob.type })
  const downloadClip = () => {
    if (!clip || !clipViewed) return
    try {
      const link = document.createElement('a')
      link.href = clip.url
      link.download = clipFile(clip.blob).name
      document.body.append(link)
      link.click()
      link.remove()
      setFailed(false)
      setMessage(motion.downloaded)
    } catch { setFailed(true); setMessage(copy('shareError')) }
  }

  const shareClip = async () => {
    if (!clip || !clipViewed) return
    setFailed(false)
    setMessage('')
    try {
      const file = clipFile(clip.blob)
      if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
        setFailed(true)
        setMessage(motion.fileUnsupported)
        return
      }
      await navigator.share({ title: story.title, text: shareText(), files: [file] })
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setFailed(true)
      setMessage(copy('shareError'))
    }
  }

  const copyText = async () => {
    setFailed(false)
    try {
      await navigator.clipboard.writeText(shareText())
      setMessage(copy('copiedShare'))
    } catch {
      setFailed(true)
      setMessage(copy('shareError'))
    }
  }

  const share = async () => {
    setFailed(false)
    try {
      if (navigator.share) {
        await navigator.share({ title: story.title, text: shareText(), url: shareUrl() })
      } else {
        await copyText()
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setFailed(true)
      setMessage(copy('shareError'))
    }
  }

  const downloadCard = async () => {
    setExporting(true)
    setFailed(false)
    setMessage('')
    let svgUrl: string | undefined
    try {
      svgUrl = URL.createObjectURL(new Blob([cardSvg], { type: 'image/svg+xml;charset=utf-8' }))
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Could not render the share card.'))
        image.src = svgUrl
      })
      const canvas = document.createElement('canvas')
      canvas.width = SHARE_CARD_SIZES[format].width
      canvas.height = SHARE_CARD_SIZES[format].height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Could not render the share card.')
      context.drawImage(image, 0, 0)
      const png = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not download the share card.')), 'image/png')
      })
      const pngUrl = URL.createObjectURL(png)
      const link = document.createElement('a')
      link.href = pngUrl
      link.download = 'muse-story-share.png'
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(pngUrl), 0)
      setMessage(studio.downloaded)
    } catch {
      setFailed(true)
      setMessage(copy('shareError'))
    } finally {
      if (svgUrl) URL.revokeObjectURL(svgUrl)
      setExporting(false)
    }
  }

  return <section aria-label={copy('shareStoryTitle')} className="story-share">
    <button type="button" className="atelier-button" aria-expanded={expanded} onClick={() => {
      if (!expanded && !prepared.current) prepareHighlight()
      if (expanded) clearClip()
      setExpanded(value => !value)
    }}>
      {copy('shareStoryTitle')}
    </button>
    {expanded ? <div className="share-studio">
      <header className="share-studio-intro">
        <p className="atelier-eyebrow">Muse</p>
        <h3>{studio.intro}</h3>
        <p>{studio.privacy}</p>
        <p className="share-studio-auto"><strong>{motion.automatic}</strong> {motion.notice}</p>
      </header>
      {!reviewing ? <>
      <div className="share-studio-layout">
        <div className="share-studio-fields">
          <label className="atelier-field">{studio.scene}
            <select value={selectedScene} onChange={event => {
              const value = event.target.value
              setSelectedScene(value)
              setPassage(value === '' ? '' : story.scenes[Number(value)].body.slice(0, 200))
            }}>
              <option value="">{studio.noPassage}</option>
              {savedScenes.map((scene, index) => <option key={index} value={index}>{index + 1} · {scene.title}</option>)}
            </select>
          </label>
          <label className="atelier-field">{studio.passage}
            <textarea value={passage} maxLength={200} rows={4} lang={language} dir={storyLanguage(language).dir}
              onChange={event => setPassage(event.target.value)} />
            <small>{passage.length}/200</small>
          </label>
          <label className="atelier-field">{studio.reflection}
            <textarea value={reflection} maxLength={120} rows={3} lang={language} dir={storyLanguage(language).dir}
              onChange={event => setReflection(event.target.value)} />
            <small>{reflection.length}/120</small>
          </label>
          <fieldset className="share-studio-picker">
            <legend>{artwork.label}</legend>
            {STORY_MOTIFS.map(value => <button key={value} type="button" aria-pressed={motif === value}
              onClick={() => setMotif(value)}>{artwork[value]}</button>)}
          </fieldset>
          <fieldset className="share-studio-picker">
            <legend>{studio.style}</legend>
            {(['starlight', 'paper', 'dawn'] as const).map(value => <button key={value} type="button" aria-pressed={theme === value}
              className={`share-style share-style--${value}`} onClick={() => setTheme(value)}>{studio[value]}</button>)}
          </fieldset>
          <fieldset className="share-studio-picker">
            <legend>{studio.format}</legend>
            {(['portrait', 'story', 'square'] as const).map(value => <button key={value} type="button" aria-pressed={format === value}
              onClick={() => setFormat(value)}>{studio[value]}</button>)}
          </fieldset>
        </div>
        <figure className="share-studio-preview">
          <div key={`${theme}:${format}`} className={`share-studio-frame share-studio-frame--${theme}`}>
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardSvg)}`} alt={studio.preview}
              width={SHARE_CARD_SIZES[format].width} height={SHARE_CARD_SIZES[format].height} />
          </div>
          <figcaption>{artwork.note}</figcaption>
        </figure>
      </div>
      <div className="atelier-actions">
        <button type="button" className="atelier-button" onClick={() => { setMessage(''); setReviewing(true) }}>{studio.previewButton}</button>
      </div>
      <details className="share-studio-ai">
        <summary>{studio.optionalAI}</summary>
        <p>{copy('teaserConsent')}</p>
    {!teaser ? <>
      {permissions.managed && !permissions.services ? <p role="alert"><a href="/account">{registrationCopy(interfaceLanguage).settings}</a></p> : !consent.accepted ? <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', margin: '1rem 0', lineHeight: 1.6 }}>
        <input type="checkbox" checked={false} disabled={!consent.ready || consent.saving} onChange={event => {
          void consent.save(event.target.checked).catch(() => { setFailed(true); setMessage(permissionCopy.error) })
        }} />
        <span>{permissionCopy.allow}</span>
      </label> : null}
      {consent.failed ? <p role="alert">{permissionCopy.error}</p> : null}
      <button type="button" className="atelier-button" disabled={!consent.accepted || !consent.ready || consent.saving || busy} onClick={() => void requestTeaser()}>
        {busy ? copy('creatingTeaser') : copy('createTeaser')}
      </button>
    </> : <>
      <h5>{copy('teaserLabel')}</h5>
      <blockquote>{teaser}</blockquote>
      <p>{story.title} · {mood}</p>
      <button type="button" onClick={() => { setPassage(teaser.slice(0, 200)); setSelectedScene('') }}>{studio.caption}</button>
    </>}
      </details>
      </> : <section aria-label={studio.preview} className="share-studio-review">
        <h4>{studio.preview}</h4>
        <button type="button" className="atelier-secondary" autoFocus disabled={exporting}
          onClick={() => { clearClip(); setMessage(''); setReviewing(false) }}>{motion.customize}</button>
        <button type="button" className="atelier-secondary" disabled={exporting || clipBusy} onClick={prepareHighlight}>{motion.regenerate}</button>
        <figure className="share-studio-preview">
          <div className={`share-studio-frame share-studio-frame--${theme}`}>
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardSvg)}`} alt={studio.preview}
              width={SHARE_CARD_SIZES[format].width} height={SHARE_CARD_SIZES[format].height} />
          </div>
          <figcaption>{artwork.note}</figcaption>
        </figure>
        <div className="share-studio-motion">
          {!clip ? <button type="button" className="atelier-button" disabled={clipBusy || exporting} onClick={() => void createClip()}>{motion.animate}</button> : <>
            <p>{motion.ready}</p>
            <video className="share-studio-video" src={clip.url} controls playsInline loop preload="metadata"
              style={{ width: `min(100%, 540px, ${75 * SHARE_CARD_SIZES[format].width / SHARE_CARD_SIZES[format].height}vh)` }}
              aria-label={motion.video} onPlay={() => setClipViewed(true)}
              onLoadedMetadata={event => {
                const duration = event.currentTarget.duration
                setClipDuration(Number.isFinite(duration) ? duration : null)
              }}
              onError={() => { setFailed(true); setMessage(motion.error); clearClip() }} />
            <p>{clip.blob.type.startsWith('video/mp4') ? 'MP4' : 'WebM'}{clipDuration !== null ? ` · ${clipDuration.toFixed(1)} s` : ''} · {SHARE_CARD_SIZES[format].width} × {SHARE_CARD_SIZES[format].height}</p>
            <div className="atelier-actions">
              <button type="button" className="atelier-button" disabled={!clipViewed} onClick={downloadClip}>{motion.download}</button>
              <button type="button" className="atelier-secondary" disabled={!clipViewed} onClick={() => void shareClip()}>{motion.share}</button>
            </div>
          </>}
          {clipBusy ? <div role="status">
            <p>{motion.creating} · {clipProgress}%</p>
            <progress value={clipProgress} max={100} aria-label={motion.creating} />
            <button type="button" onClick={() => { clearClip(); setFailed(false); setMessage(motion.cancelled) }}>{motion.cancel}</button>
          </div> : null}
        </div>
        <h4>{studio.captionPreview}</h4>
        <p className="share-studio-caption" dir={storyLanguage(language).dir}>{shareText()}</p>
        <RunwayStoryShare title={story.title} passage={passage} caption={shareText()} language={interfaceLanguage} motif={motif} />
        <div className="atelier-actions">
          <button type="button" className="atelier-button" disabled={exporting} aria-busy={exporting} onClick={() => void downloadCard()}>{copy('downloadCard')}</button>
          <button type="button" className="atelier-secondary" onClick={() => void share()}>{copy('shareOnSocial')}</button>
          <button type="button" className="atelier-secondary" onClick={() => void copyText()}>{copy('copySummary')}</button>
        </div>
      </section>}
    {message ? <p role={failed ? 'alert' : 'status'}>{message}</p> : null}
    </div> : null}
  </section>
}

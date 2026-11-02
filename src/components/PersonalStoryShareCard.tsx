import { useState } from 'react'
import { accountFetch } from '../lib/accountClient'
import { personalStoryShareText, personalStoryMoodText } from '../lib/personalStoryShareCopy'
import { createStoryMomentSvg, SHARE_CARD_SIZES, type ShareCardFormat, type ShareCardTheme } from '../lib/personalStoryShareVisual'
import { PROVIDER_CONSENT_VERSION } from '../lib/providerConsent'
import type { PersonalStory } from '../lib/story'
import type { StoryLanguageCode } from '../lib/storyLanguage'
import { useShareConsent } from '../lib/useShareConsent'
import { shareConsentCopy } from '../lib/shareConsentCopy'
import { useAccountPermissions } from '../lib/useAccountPermissions'
import { registrationCopy } from '../lib/registrationCopy'
import { shareStudioCopy } from '../lib/shareStudioCopy'
import { storyLanguage } from '../lib/storyLanguage'

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
  const [format, setFormat] = useState<ShareCardFormat>('portrait')
  const [passage, setPassage] = useState('')
  const [reflection, setReflection] = useState('')
  const [selectedScene, setSelectedScene] = useState('')
  const [exporting, setExporting] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const studio = shareStudioCopy(interfaceLanguage)
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
    title: story.title, passage, reflection, milestone, progress, theme, format,
    rtl: storyLanguage(language).dir === 'rtl'
  })

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
    <button type="button" className="atelier-button" aria-expanded={expanded} onClick={() => { setExpanded(value => !value); setReviewing(false) }}>
      {copy('shareStoryTitle')}
    </button>
    {expanded ? <div className="share-studio">
      <header className="share-studio-intro">
        <p className="atelier-eyebrow">Muse</p>
        <h3>{studio.intro}</h3>
        <p>{studio.privacy}</p>
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
          <figcaption>{studio.previewNote}</figcaption>
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
          onClick={() => { setMessage(''); setReviewing(false) }}>{studio.backToEdit}</button>
        <figure className="share-studio-preview">
          <div className={`share-studio-frame share-studio-frame--${theme}`}>
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardSvg)}`} alt={studio.preview}
              width={SHARE_CARD_SIZES[format].width} height={SHARE_CARD_SIZES[format].height} />
          </div>
          <figcaption>{studio.previewNote}</figcaption>
        </figure>
        <h4>{studio.captionPreview}</h4>
        <p className="share-studio-caption" dir={storyLanguage(language).dir}>{shareText()}</p>
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

import { useState } from 'react'
import { accountFetch } from '../lib/accountClient'
import { personalStoryShareText, personalStoryMoodText } from '../lib/personalStoryShareCopy'
import { createPersonalStoryShareSvg, personalStoryShareText as buildPersonalStoryShareText } from '../lib/personalStoryShareVisual'
import { PROVIDER_CONSENT_VERSION } from '../lib/providerConsent'
import type { PersonalStory } from '../lib/story'
import type { StoryLanguageCode } from '../lib/storyLanguage'

export default function PersonalStoryShareCard({
  story,
  interfaceLanguage
}: {
  story: Pick<PersonalStory, 'title' | 'mood' | 'language'>
  interfaceLanguage: StoryLanguageCode
}) {
  const [consent, setConsent] = useState(false)
  const [teaser, setTeaser] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const language = story.language ?? interfaceLanguage
  const mood = personalStoryMoodText(story.mood, language)
  const copy = (key: Parameters<typeof personalStoryShareText>[0]) => personalStoryShareText(key, interfaceLanguage)

  const requestTeaser = async () => {
    setBusy(true)
    setMessage('')
    try {
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
      setMessage(cause instanceof Error ? cause.message : copy('shareError'))
    } finally {
      setBusy(false)
    }
  }

  const shareUrl = () => `${window.location.origin}/?utm_source=personal-story-share`
  const shareText = () => buildPersonalStoryShareText(story.title, teaser, mood, copy('shareTextFooter'), shareUrl())

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText())
      setMessage(copy('copiedShare'))
    } catch {
      setMessage(copy('shareError'))
    }
  }

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: story.title, text: shareText(), url: shareUrl() })
      } else {
        await copyText()
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setMessage(copy('shareError'))
    }
  }

  const downloadCard = async () => {
    const url = shareUrl()
    const svg = createPersonalStoryShareSvg({
      title: story.title,
      teaser,
      mood,
      brand: 'Muse',
      tagline: copy('shareCardTagline'),
      url
    })
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    try {
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Could not render the share card.'))
        image.src = svgUrl
      })
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1350
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
      setMessage(copy('shareReady'))
    } catch {
      setMessage(copy('shareError'))
    } finally {
      URL.revokeObjectURL(svgUrl)
    }
  }

  return <section className="atelier-card" aria-labelledby="share-story-heading" style={{ marginTop: '1rem' }}>
    <h4 id="share-story-heading">{copy('shareStoryTitle')}</h4>
    <p>{copy('shareStoryDescription')}</p>
    {!teaser ? <>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', margin: '1rem 0', lineHeight: 1.6 }}>
        <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
        <span>{copy('teaserConsent')}</span>
      </label>
      <button type="button" className="atelier-button" disabled={!consent || busy} onClick={() => void requestTeaser()}>
        {busy ? copy('creatingTeaser') : copy('createTeaser')}
      </button>
    </> : <>
      <h5>{copy('teaserLabel')}</h5>
      <blockquote>{teaser}</blockquote>
      <p>{story.title} · {mood}</p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void share()}>{copy('shareOnSocial')}</button>
        <button type="button" onClick={() => void copyText()}>{copy('copySummary')}</button>
        <button type="button" onClick={() => void downloadCard()}>{copy('downloadCard')}</button>
      </div>
    </>}
    {message ? <p role="status">{message}</p> : null}
  </section>
}

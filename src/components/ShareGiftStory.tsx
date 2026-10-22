import { useId, useState, type ReactNode } from 'react'
import GiftCard from './GiftCard'

export default function ShareGiftStory({
  recipientUrl,
  shareText,
  expiresAt,
  disabled = false,
  localOnly = false,
  whatsappUrl,
  showWhatsapp = true,
  beforeShare,
  onShareStart,
  previewContent
}: {
  recipientUrl: string
  shareText: string
  expiresAt: string | null
  disabled?: boolean
  localOnly?: boolean
  whatsappUrl?: string
  showWhatsapp?: boolean
  beforeShare?: () => boolean
  onShareStart?: () => void
  previewContent?: ReactNode
}) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [feedback, setFeedback] = useState('')
  const webShareAvailable = !localOnly && typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const canProceed = () => !disabled && Boolean(recipientUrl) && (beforeShare?.() ?? true)
  const copyRecipientLink = async () => {
    if (!canProceed()) return
    setFeedback('')
    try {
      if (!navigator.clipboard) throw new Error('Clipboard access is unavailable.')
      await navigator.clipboard.writeText(recipientUrl)
      setFeedback(localOnly
        ? 'Recipient link copied. This local-only address will not work on another device.'
        : 'Recipient link copied. Deleting the story or replacing its link disables this one.')
    } catch {
      setFeedback('Could not copy the recipient link. Select and copy it from the field below.')
    }
  }
  const shareWithDevice = async () => {
    if (!webShareAvailable || sharing || !canProceed()) return
    setFeedback('')
    onShareStart?.()
    setSharing(true)
    try {
      await navigator.share({ title: 'A Muse story for you', text: shareText, url: recipientUrl })
      setFeedback('Link handed to your device sharing app. Delivery is handled by that app.')
    } catch (error) {
      setFeedback(error instanceof Error && error.name === 'AbortError'
        ? 'Sharing cancelled. Your story and link are unchanged.'
        : 'Could not open device sharing. Copy the recipient link instead.')
    } finally {
      setSharing(false)
    }
  }

  return <section aria-label="Share gift story">
    <button type="button" className="atelier-button" disabled={disabled} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
      Share
    </button>
    {open ? <div id={panelId} role="region" aria-label="Gift story sharing options" style={{ marginTop: '0.75rem', padding: '1rem', border: '1px solid #e4dcd4', borderRadius: 16 }}>
      {localOnly ? <p role="note">Local link: works only on this computer. External sharing and printable QR are disabled.</p> : null}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {webShareAvailable ? <button type="button" className="atelier-secondary" disabled={disabled || sharing} onClick={() => void shareWithDevice()}>
          {sharing ? 'Opening sharing...' : 'Share with another app'}
        </button> : null}
        <button type="button" className="atelier-secondary" disabled={disabled || !recipientUrl} onClick={() => void copyRecipientLink()}>Copy recipient link</button>
        {showWhatsapp && !localOnly && whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" aria-disabled={disabled}
          onClick={event => {
            if (!canProceed()) event.preventDefault()
            else onShareStart?.()
          }} style={{ alignSelf: 'center', color: 'inherit' }}>Share on WhatsApp</a> : null}
        {!localOnly ? <GiftCard recipientUrl={recipientUrl} expiresAt={expiresAt} disabled={disabled || sharing} /> : null}
      </div>
      {recipientUrl ? <label style={{ display: 'block', marginTop: '0.75rem' }}>Recipient link
        <input readOnly value={recipientUrl} onFocus={event => event.target.select()} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '0.35rem' }} />
      </label> : null}
      {feedback ? <p role={feedback.startsWith('Could not') ? 'alert' : 'status'}>{feedback}</p> : null}
      {previewContent ? <details style={{ marginTop: '0.75rem' }}>
        <summary>Preview what recipient sees</summary>
        <div style={{ marginTop: '0.75rem' }}>{previewContent}</div>
      </details> : null}
      <p>Only the recipient link is shared, not private answers or reveals. On phones, Share with another app can open available apps such as WhatsApp or Instagram. Otherwise copy the link and paste it into a message or post.</p>
    </div> : null}
  </section>
}

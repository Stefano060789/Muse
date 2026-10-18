import { useEffect, useRef, useState } from 'react'
import { giftCardHtml, validateGiftCardLink } from '../lib/giftCard'
import { storyHasAccess } from '../lib/storyRetention'

export default function GiftCard({ recipientUrl, expiresAt, disabled = false }: {
  recipientUrl: string
  expiresAt: string | null
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [greeting, setGreeting] = useState('A little adventure, just for you.')
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [printUrl, setPrintUrl] = useState('')
  const expired = !storyHasAccess(expiresAt)
  useEffect(() => {
    if (!open) return
    dialog.current?.showModal()
    let active = true
    setQr(''); setError('')
    import('qrcode').then(module => module.toDataURL(validateGiftCardLink(recipientUrl), { width: 360, margin: 4, errorCorrectionLevel: 'M' }))
      .then(value => { if (active) setQr(value) })
      .catch(() => { if (active) setError('The QR code could not be prepared. Retry opening this card or use the recipient link.') })
    return () => { active = false }
  }, [open, recipientUrl])
  useEffect(() => {
    if (!open || !qr) return
    let html: string
    try { html = giftCardHtml(recipientUrl, expiresAt, greeting, qr) }
    catch (cause) { setReady(false); setError(cause instanceof Error ? cause.message : 'The printable gift card is invalid.'); return }
    setReady(false)
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    setPrintUrl(url)
    return () => { URL.revokeObjectURL(url); setPrintUrl(''); setReady(false) }
  }, [open, qr, greeting, recipientUrl, expiresAt])
  return <>
    <button type="button" disabled={disabled || expired || !recipientUrl} onClick={() => { setReady(false); setOpen(true) }}>Create printable QR code</button>
    {open ? <dialog ref={dialog} onCancel={() => setOpen(false)} aria-label="Printable gift card" style={{ width: 'min(760px, 96vw)', maxHeight: '92vh', overflowY: 'auto', border: '1px solid #ac8450', borderRadius: 20, padding: '1rem', background: '#f7f3ed' }}>
      <h2>A gift story you can hand over.</h2>
      <p>The QR code is created on this device, without sending the link to a QR service. Anyone holding the card can open the recipient link. Never print a management link. Replacing the recipient link or deleting the story invalidates the printed card. {expiresAt === null ? 'This story has no automatic expiry.' : 'This card also stops working when its story link expires.'}</p>
      <label>A short greeting<textarea maxLength={240} rows={2} value={greeting} onChange={event => setGreeting(event.target.value)} style={{ display: 'block', width: '100%' }} /></label>
      <p>Use only a greeting appropriate for the printed card; it is visible before any online content notice. No story text, answer, reveal or media is copied automatically.</p>
      {error ? <p role="alert">{error}</p> : null}
      {!qr && !error ? <p role="status">Preparing your QR card...</p> : null}
      <div className="atelier-actions">
        <button type="button" disabled={!ready || expired || disabled} onClick={() => {
          try {
            if (!storyHasAccess(expiresAt) || disabled) throw new Error('This recipient link is no longer ready to share.')
            const target = frame.current?.contentWindow
            if (!target) throw new Error('The printable card is not ready.')
            target.focus(); target.print()
          } catch (cause) { setError(cause instanceof Error ? cause.message : 'Printing failed. Try your device browser.') }
        }}>Print / Save card as PDF</button>
        <button type="button" onClick={() => setOpen(false)}>Back to story</button>
      </div>
      {printUrl ? <iframe ref={frame} title="Gift card print preview" src={printUrl} sandbox="allow-same-origin allow-modals" onLoad={() => setReady(true)} onError={() => setError('The printable card could not load. Try your device browser.')} style={{ width: '100%', height: '55vh', border: 0 }} /> : null}
    </dialog> : null}
  </>
}

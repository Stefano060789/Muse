import { useEffect, useRef, useState } from 'react'
import { keepsakeHtml, type KeepsakeStory } from '../lib/storyKeepsake'

export default function StoryKeepsake({ story }: { story: KeepsakeStory }) {
  const [open, setOpen] = useState(false)
  const [includeMessage, setIncludeMessage] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [printUrl, setPrintUrl] = useState('')
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal()
  }, [open])
  const html = keepsakeHtml(story, includeMessage)
  useEffect(() => {
    if (!open) return
    setReady(false)
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    setPrintUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [open, html])
  return <>
    <button type="button" onClick={() => { setIncludeMessage(false); setError(''); setOpen(true) }} style={{ padding: '0.8rem 1rem', minHeight: 44, borderRadius: 24, border: '1px solid #d9cfc5', background: 'white', cursor: 'pointer' }}>Save a keepsake</button>
    {open ? <dialog ref={dialog} onCancel={() => setOpen(false)} aria-label="Story keepsake" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', margin: 0, boxSizing: 'border-box', border: 0, background: '#f7f3ed', overflowY: 'auto', padding: '1rem' }}>
      <div className="muse-keepsake-tools" style={{ maxWidth: 680, margin: '0 auto 1rem' }}>
        <h2>Your keepsake</h2>
        <p>Print or choose Save as PDF in your device&apos;s print menu. Only the story text below is included. Answers, links, replies, photos, video and voice recordings are excluded.</p>
        {story.message ? <label style={{ display: 'block', padding: '0.75rem 0' }}><input type="checkbox" checked={includeMessage} onChange={event => setIncludeMessage(event.target.checked)} /> Include the private final message</label> : null}
        {error ? <p role="alert">{error}</p> : null}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" disabled={!ready} onClick={() => {
            try {
              const target = frame.current?.contentWindow
              if (!target || typeof target.print !== 'function') throw new Error('Printing is unavailable in this browser. Try your device browser instead.')
              target.focus()
              target.print()
            } catch (error) { setError(error instanceof Error ? error.message : 'Could not open printing. Try your device browser.') }
          }} style={{ padding: '0.8rem 1rem', minHeight: 44 }}>Print / Save as PDF</button>
          <button type="button" autoFocus onClick={() => setOpen(false)} style={{ padding: '0.8rem 1rem', minHeight: 44 }}>Back to story</button>
        </div>
      </div>
      {printUrl ? <iframe ref={frame} src={printUrl} title="Printable story preview" sandbox="allow-same-origin allow-modals" onLoad={() => setReady(true)} onError={() => setError('The printable preview could not load. Try your device browser.')} style={{ display: 'block', width: '100%', maxWidth: 720, height: '65vh', border: '1px solid #d9cfc5', margin: '0 auto', background: 'white' }} /> : null}
    </dialog> : null}
  </>
}

import { useEffect, useRef, useState } from 'react'

type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallApp() {
  const prompt = useRef<InstallPrompt | null>(null)
  const [available, setAvailable] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [ios, setIos] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)')
    const update = () => setInstalled(standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    update()
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    const beforeInstall = (event: Event) => { event.preventDefault(); prompt.current = event as InstallPrompt; setAvailable(true) }
    const onInstalled = () => { setInstalled(true); setAvailable(false); prompt.current = null }
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    standalone.addEventListener('change', update)
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      standalone.removeEventListener('change', update)
    }
  }, [])
  if (installed) return null
  return <details style={{ padding: '0.75rem 0' }}>
    <summary style={{ cursor: 'pointer' }}>Keep Muse on your home screen</summary>
    <p style={{ lineHeight: 1.7 }}>{ios ? 'In Safari, open Share, then Add to Home Screen. If offered, keep Open as Web App enabled.' : available ? 'Install Muse to open it in its own app-like window.' : 'Open Muse in your device browser, then look for Install app or Add to Home screen in its menu. Availability depends on the browser.'}</p>
    {available ? <button type="button" style={{ padding: '0.8rem 1rem', minHeight: 44, borderRadius: 24, cursor: 'pointer' }} onClick={async () => {
      const event = prompt.current
      if (!event) { setMessage('Use your browser menu to install Muse.'); return }
      try {
        await event.prompt()
        const result = await event.userChoice
        setMessage(result.outcome === 'accepted' ? 'Installation accepted. Your browser will finish setup.' : 'Installation cancelled. You can keep using Muse here.')
      } catch { setMessage('The install prompt could not open. Use Install app in your browser menu instead.') }
      finally { prompt.current = null; setAvailable(false) }
    }}>Install Muse</button> : null}
    {message ? <p role="status">{message}</p> : null}
    <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>An internet connection is still needed. Private stories are not cached for offline use. Installation does not sync your library or drafts across devices.</p>
  </details>
}

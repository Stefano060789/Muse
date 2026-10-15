import Head from 'next/head'
import { useEffect, useState } from 'react'

export default function AppInstallSupport() {
  const [error, setError] = useState('')
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator) || !window.isSecureContext) return
    let active = true
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      if (active) setError('App installation support could not load. Muse still works in this browser; check your connection and reload to retry.')
    })
    return () => { active = false }
  }, [])
  return <>
    <Head>
      <link rel="manifest" href="/manifest.webmanifest" />
      <link rel="apple-touch-icon" href="/icons/muse-180.png" />
      <meta name="theme-color" content="#f7f3ed" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="Muse" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    </Head>
    {error ? <p role="status" style={{ padding: '0.75rem 1.5rem', margin: 0, background: '#fffaf6', color: '#a14329' }}>{error}</p> : null}
  </>
}

import Head from 'next/head'
import { useEffect, useMemo, useState } from 'react'

type OpsStatus = {
  day: string
  used: number
  cap: number
  remaining: number
  warningAt: number
  alerts: Array<{ event: string; created_at: string }>
  alertDelivery: string
  publicBetaReady: boolean
  blockers: string[]
  backupVerification: string
}

export default function CreatorDashboard() {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<OpsStatus | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const costPerAttempt = Number(process.env.NEXT_PUBLIC_MUSE_AI_COST_PER_ATTEMPT_CENTS || 0)
  const metrics = useMemo(() => {
    const stories = status?.alerts.filter(alert => alert.event === 'story-created').length || 0
    const estimatedCents = status ? status.used * costPerAttempt : 0
    return { stories, estimatedCents }
  }, [status, costPerAttempt])
  useEffect(() => { setCode('') }, [])
  const refresh = async () => {
    setLoading(true); setError(''); setStatus(null)
    try {
      const response = await fetch('/api/operations', { headers: { 'x-muse-operations-code': code }, cache: 'no-store' })
      const body: unknown = await response.json()
      if (!response.ok) throw new Error(body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'Could not load creator status.')
      setStatus(body as OpsStatus)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Creator dashboard unavailable.')
    } finally {
      setLoading(false)
    }
  }
  return <>
    <Head>
      <title>Muse — Creator dashboard</title>
      <meta name="description" content="Private dashboard for the Muse creator." />
      <meta name="robots" content="noindex,nofollow" />
      <meta name="referrer" content="no-referrer" />
    </Head>
    <main className="atelier-page">
      <div className="atelier-shell atelier-shell--narrow atelier-reading">
        <p className="atelier-eyebrow">Private creator dashboard</p>
        <h1 className="atelier-title">Operations overview</h1>
        <div className="atelier-card">
          <p>This page is protected by a private operations credential. It does not expose story text or private links.</p>
          <label className="atelier-field">Operations access code<input type="password" autoComplete="off" value={code} onChange={event => setCode(event.target.value)} /></label>
          <button className="atelier-button" type="button" disabled={!code || loading} onClick={() => void refresh()}>{loading ? 'Loading…' : 'Load dashboard'}</button>
          {error ? <p role="alert">{error}</p> : null}
        </div>
        {status ? <section className="atelier-card">
          <h2>Overview</h2>
          <dl>
            <dt>Story creation events in recent alerts</dt><dd>{metrics.stories}</dd>
            <dt>AI attempts used today</dt><dd>{status.used} / {status.cap}</dd>
            <dt>AI credits remaining today</dt><dd>{status.remaining}</dd>
            <dt>Estimated Claude Haiku spend</dt><dd>{costPerAttempt ? `€${(metrics.estimatedCents / 100).toFixed(2)}` : 'Set NEXT_PUBLIC_MUSE_AI_COST_PER_ATTEMPT_CENTS to estimate cost'}</dd>
          </dl>
          <p>{status.alertDelivery}</p>
          <p>{status.backupVerification}</p>
          <h3>Recent alerts</h3>
          {status.alerts.length ? <ul>{status.alerts.map((alert, index) => <li key={`${alert.created_at}:${index}`}>{alert.created_at}: {alert.event}</li>)}</ul> : <p>No recent telemetry yet.</p>}
        </section> : null}
      </div>
    </main>
  </>
}

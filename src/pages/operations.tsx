import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import type { productionOperationStatus } from '../lib/operations'

type Status = Awaited<ReturnType<typeof productionOperationStatus>>
function isStatus(body: unknown): body is Status {
  if (!body || typeof body !== 'object') return false
  return 'day' in body && typeof body.day === 'string' &&
    'used' in body && typeof body.used === 'number' && Number.isInteger(body.used) &&
    'cap' in body && typeof body.cap === 'number' && Number.isInteger(body.cap) &&
    'remaining' in body && typeof body.remaining === 'number' &&
    'warningAt' in body && typeof body.warningAt === 'number' &&
    'publicBetaReady' in body && body.publicBetaReady === false &&
    'alertDelivery' in body && typeof body.alertDelivery === 'string' &&
    'backupVerification' in body && typeof body.backupVerification === 'string' &&
    'blockers' in body && Array.isArray(body.blockers) && body.blockers.every(item=>typeof item === 'string') &&
    'alerts' in body && Array.isArray(body.alerts) && body.alerts.every(item=>
      item && typeof item === 'object' && typeof item.event === 'string' && typeof item.created_at === 'string')
}

export default function OperationsPage() {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const refresh = async () => {
    setLoading(true); setError(''); setStatus(null)
    try {
      const response = await fetch('/api/operations', { headers: { 'x-muse-operations-code': code }, cache: 'no-store' })
      const body: unknown = await response.json()
      if (!response.ok) throw new Error(body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'Could not load operational status.')
      if (!isStatus(body)) throw new Error('Operational status returned invalid data.')
      setStatus(body)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Operational status unavailable.')
    } finally { setLoading(false) }
  }
  return <>
    <Head><title>Muse — Operations</title><meta name="robots" content="noindex,nofollow" /><meta name="referrer" content="no-referrer" /></Head>
    <main style={{ maxWidth: 850, margin: '0 auto', padding: '1.5rem', fontFamily: 'Georgia, serif', overflowWrap: 'anywhere' }}>
      <Link href="/">Muse</Link>
      <h1>Private operations</h1>
      <label>Operations access code <input type="password" autoComplete="off" maxLength={512} value={code} onChange={e=>setCode(e.target.value)} /></label>
      <p>Code stays in page memory. Nothing below contains story text or private links.</p>
      <button disabled={loading || !code} onClick={()=>void refresh()}>{loading ? 'Loading…' : 'Refresh status'}</button>
      {error && <p role="alert">{error}</p>}
      {status && <>
        <h2>Daily AI allowance</h2>
        <p>{status.used}/{status.cap} attempts on {status.day} (UTC). Warning at {status.warningAt}. Failures and enabled paid narration count.</p>
        <p>This is an attempt cap, not a dollar cap. Provider-account spending controls are still required.</p>
        <h2>Public beta: blocked</h2>
        <ul>{status.blockers.map(blocker=><li key={blocker}>{blocker}</li>)}</ul>
        <p>Backup: {status.backupVerification}</p>
        <h2>Alerts</h2>
        <p>{status.alertDelivery}</p>
        {status.alerts.length ? <ul>{status.alerts.map((alert,index)=><li key={`${alert.created_at}:${index}`}>{alert.created_at}: {alert.event}</li>)}</ul> : <p>No alerts in the last seven days.</p>}
      </>}
    </main>
  </>
}

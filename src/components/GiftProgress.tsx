import { useEffect, useRef, useState } from 'react'
import type { SharedStoryProgress } from '../lib/sharedStoryProgress'

export default function GiftProgress({ load, sceneCount, adventure, compact = false, snapshot }: {
  load: () => Promise<SharedStoryProgress>; sceneCount: number; adventure: boolean; compact?: boolean; snapshot?: SharedStoryProgress
}) {
  const [progress, setProgress] = useState<SharedStoryProgress | null>(snapshot || null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const mounted = useRef(false)
  const pending = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { setProgress(snapshot || null); setError('') }, [snapshot])
  const refresh = async () => {
    if (pending.current) return
    pending.current = true
    setBusy(true); setError(''); setProgress(null)
    try {
      const result = await load()
      if (mounted.current) setProgress(result)
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not load recipient progress.')
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const total = progress?.sceneCount === undefined ? adventure ? null : sceneCount : progress.sceneCount
  const reached = !progress?.opened || progress.furthestScene === null ? 0 : progress.furthestScene + 1
  return <section aria-label="Recipient progress" className={compact ? undefined : 'atelier-card'} style={compact ? { minWidth: 0, maxWidth: '100%' } : undefined}>
    {!compact ? <h2>Story progress</h2> : null}
    <button type="button" className="atelier-button" disabled={busy} onClick={() => void refresh()}>
      {busy ? 'Loading progress...' : progress ? 'Refresh story progress' : 'View story progress'}
    </button>
    {error ? <p role="alert">{error}</p> : null}
    {progress ? <>
      <p role="status">
        {total === null ? `${reached} ${reached === 1 ? 'scene' : 'scenes'} · ` : `${Math.min(reached, total)}/${total} · `}
        {progress.solved + progress.skipped > 0 ? 'Finished' : 'Not finished'}
      </p>
    </> : null}
  </section>
}

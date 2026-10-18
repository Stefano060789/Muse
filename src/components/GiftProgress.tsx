import { useEffect, useRef, useState } from 'react'
import type { SharedStoryProgress } from '../lib/sharedStoryProgress'

export default function GiftProgress({ load, sceneCount, adventure, compact = false }: {
  load: () => Promise<SharedStoryProgress>; sceneCount: number; adventure: boolean; compact?: boolean
}) {
  const [progress, setProgress] = useState<SharedStoryProgress | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const mounted = useRef(false)
  const pending = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
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
  return <section aria-label="Recipient progress" className={compact ? undefined : 'atelier-card'} style={compact ? { minWidth: 0, maxWidth: '100%' } : undefined}>
    {!compact ? <h2>Story progress</h2> : null}
    <button type="button" className="atelier-button" disabled={busy} onClick={() => void refresh()}>
      {busy ? 'Loading progress...' : progress ? 'Refresh story progress' : 'View story progress'}
    </button>
    {error ? <p role="alert">{error}</p> : null}
    {progress ? <>
      <p role="status">
        {!progress.opened ? 'Not started' : <>
          {!adventure && progress.furthestScene !== null ? `Scene ${Math.min(progress.furthestScene + 1, sceneCount)} of ${sceneCount} reached · ` : ''}
          {progress.solved + progress.skipped > 0 ? 'Finished' : 'Not finished'}
        </>}
      </p>
      {adventure && progress.opened ? <p>Live adventures do not have a fixed scene count. Finished means the ending was unlocked.</p> : null}
      <details>
        <summary>About story progress</summary>
        <p>Shows the furthest scene reached across browser playthroughs, including earlier recipient links. Finished means at least one playthrough unlocked the ending, by solving or revealing it. It does not measure audio listened to or verify who read the story.</p>
        <p>Refresh to check again. No live monitoring or extra AI generation.</p>
      </details>
    </> : null}
  </section>
}

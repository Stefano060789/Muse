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
    {!compact ? <><h2>Recipient progress</h2>
    <p>Private overview of browser playthroughs, not verified people. Opening the link counts as a start; another browser or cleared storage can count again. Counts include earlier recipient links for this story.</p></> : null}
    <button type="button" className="atelier-button" disabled={busy} onClick={() => void refresh()}>
      {busy ? 'Loading progress...' : compact ? 'Check completion' : progress ? 'Refresh progress' : 'Load progress'}
    </button>
    {error ? <p role="alert">{error}</p> : null}
    {progress ? <>
      <dl aria-live="polite">
        <dt>Opened playthroughs</dt><dd>{progress.opened}</dd>
        <dt>Still in progress</dt><dd>{progress.inProgress}</dd>
        <dt>Completed by solving</dt><dd>{progress.solved}</dd>
        <dt>Revealed without solving</dt><dd>{progress.skipped}</dd>
        {!adventure && progress.furthestScene !== null ? <><dt>Furthest scene reached</dt><dd>{Math.min(progress.furthestScene + 1, sceneCount)} of {sceneCount}</dd></> : null}
      </dl>
      {!progress.opened ? <p>No playthroughs recorded yet.</p> : null}
      {compact ? <p>Counts represent browser playthroughs, not verified people, and include earlier recipient links. A different browser or cleared storage can count again.</p> : null}
      <p>Not completed does not mean failed. Reaching the last scene is not the same as solving the mystery. Refresh to check again; there is no live monitoring or extra AI generation.</p>
    </> : null}
  </section>
}

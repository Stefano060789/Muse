import { useEffect, useRef, useState } from 'react'
import type { SharedStoryProgress } from '../lib/sharedStoryProgress'
import type { CollectionCopy } from '../lib/interfacePages'

export default function GiftProgress({ load, sceneCount, adventure, copy, compact = false, snapshot }: {
  load: () => Promise<SharedStoryProgress>; sceneCount: number; adventure: boolean; compact?: boolean; snapshot?: SharedStoryProgress
  copy: CollectionCopy
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
  const reached = !progress?.opened || progress.furthestScene === null ? null : progress.furthestScene + 1
  const sceneLabel = reached === null ? copy.notStarted
    : total === null ? copy.scene(reached)
      : copy.sceneRange(Math.min(reached, total), total)
  return <section aria-label={copy.recipientProgress} className={compact ? undefined : 'atelier-card'} style={compact ? { minWidth: 0, maxWidth: '100%' } : undefined}>
    {!compact ? <h2>{copy.progressTitle}</h2> : null}
    <button type="button" className="atelier-button" disabled={busy} onClick={() => void refresh()}>
      {busy ? copy.loadingProgress : progress ? copy.refreshProgress : copy.viewProgress}
    </button>
    {error ? <p role="alert">{error}</p> : null}
    {progress ? <>
      <p role="status">{sceneLabel}{' · '}{progress.solved + progress.skipped > 0 ? copy.finished : copy.notFinished}</p>
    </> : null}
  </section>
}

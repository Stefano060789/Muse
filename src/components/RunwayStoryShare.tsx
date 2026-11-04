import { useEffect, useRef, useState } from 'react'
import { accountFetch } from '../lib/accountClient'
import { RUNWAY_SHARE_CONSENT, RUNWAY_SHARE_CREDITS, RUNWAY_SHARE_MODEL, RUNWAY_SHARE_RATIO, RUNWAY_SHARE_SECONDS, suggestedRunwayBrief, validRunwayBrief } from '../lib/runwayShareBrief'
import { runwayShareCopy } from '../lib/runwayShareCopy'
import type { StoryLanguageCode } from '../lib/storyLanguage'
import { createRunwayFrameDataUrl } from '../lib/runwayShareFrame'
import type { StoryMotif } from '../lib/storyShareArtwork'

type Job = { id: string; status: 'submitted' | 'ready' | 'failed' | 'unknown'; credits: number; createdAt: string }
type Quote = { available: boolean; model: string; ratio: string; credits: number; seconds: number; estimatedUsd: number; consentVersion: string }
class CinematicRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}
function parsedJob(value: unknown): Job {
  if (!value || typeof value !== 'object') throw new Error('Invalid cinematic job response.')
  const row = value as Job
  if (typeof row.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(row.id) ||
    !['submitted', 'ready', 'failed', 'unknown'].includes(row.status) || row.credits !== RUNWAY_SHARE_CREDITS ||
    typeof row.createdAt !== 'string') throw new Error('Invalid cinematic job response.')
  return row
}
async function jsonRequest(body: unknown, signal?: AbortSignal): Promise<unknown> {
  const response = await accountFetch('/api/runway-share', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal
  })
  const data = await response.json()
  if (!response.ok) throw new CinematicRequestError(typeof data.error === 'string' ? data.error : 'Cinematic request failed.', response.status)
  return data
}
export default function RunwayStoryShare({ title, passage, caption, language, motif }: {
  title: string; passage: string; caption: string; language: StoryLanguageCode; motif: StoryMotif
}) {
  const copy = runwayShareCopy(language)
  const [open, setOpen] = useState(false)
  const [brief, setBrief] = useState('')
  const [approved, setApproved] = useState(false)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [video, setVideo] = useState<{ url: string; blob: Blob } | null>(null)
  const [viewed, setViewed] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url) }, [video])

  const loadJobs = async (signal?: AbortSignal) => {
    const data = await jsonRequest({ action: 'list' }, signal)
    if (!data || typeof data !== 'object' || !('jobs' in data) || !Array.isArray(data.jobs)) throw new Error(copy.error)
    const rows = data.jobs.map(parsedJob)
    if (active.current && !signal?.aborted) setJobs(rows)
  }
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const value = await jsonRequest({ action: 'quote' }, controller.signal)
        if (!value || typeof value !== 'object') throw new Error(copy.error)
        const data = value as Quote
        if (typeof data.available !== 'boolean' || data.credits !== RUNWAY_SHARE_CREDITS || data.model !== RUNWAY_SHARE_MODEL ||
          data.ratio !== RUNWAY_SHARE_RATIO || data.seconds !== RUNWAY_SHARE_SECONDS ||
          data.estimatedUsd !== RUNWAY_SHARE_CREDITS * 0.01 || data.consentVersion !== RUNWAY_SHARE_CONSENT) throw new Error(copy.error)
        if (!controller.signal.aborted) setQuote(data)
        if (data.available) await loadJobs(controller.signal)
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : copy.error)
      } finally { if (!controller.signal.aborted) setLoading(false) }
    })()
    return () => controller.abort()
  }, [open])
  useEffect(() => {
    if (!open || job?.status !== 'submitted') return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void jsonRequest({ action: 'status', id: job.id }, controller.signal).then(value => {
        if (!controller.signal.aborted) setJob(parsedJob(value))
      }).catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : copy.error)
      })
    }, 10000)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [open, job])
  useEffect(() => {
    setVideo(null)
    setViewed(false)
    if (!open || job?.status !== 'ready') return
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await accountFetch('/api/runway-share', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'video', id: job.id }), signal: controller.signal
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(typeof data.error === 'string' ? data.error : copy.error)
        }
        const blob = await response.blob()
        if (blob.type !== 'video/mp4' || blob.size < 12 || blob.size > 30 * 1024 * 1024) throw new Error(copy.error)
        if (!controller.signal.aborted) setVideo({ blob, url: URL.createObjectURL(blob) })
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : copy.error) }
    })()
    return () => controller.abort()
  }, [open, job?.id, job?.status])

  const generate = async () => {
    if (pending.current || job || !approved || !quote?.available || !validRunwayBrief(brief)) return
    pending.current = true
    setSubmitting(true)
    setError('')
    let id: string | undefined
    let requestStarted = false
    try {
      id = crypto.randomUUID()
      const frame = await createRunwayFrameDataUrl(motif)
      if (!active.current) return
      requestStarted = true
      const value = await jsonRequest({
        action: 'create', id, brief, frame, approved: true, approvedCredits: quote.credits, consentVersion: quote.consentVersion
      })
      if (active.current) { setJob(parsedJob(value)); setApproved(false) }
    } catch (cause) {
      if (active.current) {
        const rejectedBeforeSubmission = cause instanceof CinematicRequestError && [400, 401, 403, 409, 429].includes(cause.status)
        if (requestStarted && id && !rejectedBeforeSubmission) setJob({ id, status: 'unknown', credits: RUNWAY_SHARE_CREDITS, createdAt: new Date().toISOString() })
        setApproved(false)
        setError(cause instanceof Error ? cause.message : copy.error)
      }
    } finally {
      pending.current = false
      if (active.current) setSubmitting(false)
    }
  }
  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      await loadJobs()
      if (job) setJob(parsedJob(await jsonRequest({ action: 'status', id: job.id })))
    } catch (cause) { setError(cause instanceof Error ? cause.message : copy.error) }
    finally { setLoading(false) }
  }
  const download = () => {
    if (!video || !viewed) return
    try {
      const link = document.createElement('a')
      link.href = video.url
      link.download = 'muse-cinematic-highlight.mp4'
      document.body.append(link); link.click(); link.remove()
    } catch { setError(copy.error) }
  }
  const share = async () => {
    if (!video || !viewed) return
    setError('')
    try {
      const file = new File([video.blob], 'muse-cinematic-highlight.mp4', { type: 'video/mp4' })
      if (!navigator.share || !navigator.canShare?.({ files: [file] })) { setError(copy.shareUnavailable); return }
      await navigator.share({ files: [file], title, text: caption })
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setError(copy.error)
    }
  }
  return <section className="runway-share" aria-label={copy.title}>
    <button type="button" className="atelier-button" aria-expanded={open} onClick={() => {
      if (!open && !brief) setBrief(suggestedRunwayBrief(title, passage))
      setApproved(false)
      setOpen(value => !value)
    }}>{copy.open}</button>
    {open ? <div className="runway-share-panel">
      <h4>{copy.title}</h4>
      <p>{copy.disclosure}</p>
      {loading ? <p role="status">{copy.loading}</p> : null}
      {quote && !quote.available ? <p>{copy.unavailable}</p> : null}
      {!job ? <label className="atelier-field">{copy.brief}
        <textarea value={brief} maxLength={900} rows={6} lang="en" dir="ltr" disabled={submitting}
          onChange={event => { setBrief(event.target.value); setApproved(false) }} />
      </label> : null}
      {quote ? <p><strong>{copy.cost}: {quote.credits} · US${quote.estimatedUsd.toFixed(2)}</strong><br />{copy.estimate}<br />
        {quote.model} · {quote.seconds} s · 720 × 1280</p> : null}
      {!job ? <>
        <label className="runway-share-approval"><input type="checkbox" checked={approved} disabled={submitting || !quote?.available}
          onChange={event => setApproved(event.target.checked)} /> {copy.approve}</label>
        <button type="button" className="atelier-button" disabled={submitting || !quote?.available || !approved || !validRunwayBrief(brief)}
          onClick={() => void generate()}>{submitting ? copy.submitting : copy.generate}</button>
      </> : <>
        <p role="status">{job.status === 'submitted' ? copy.pending : job.status === 'failed' ? copy.failure : job.status === 'unknown' ? copy.unknown : copy.ready}</p>
        <p>{copy.status}: {job.id}</p>
        {video ? <div>
          <video src={video.url} controls playsInline loop preload="metadata" className="runway-share-video" aria-label={copy.title}
            onPlay={() => setViewed(true)} onError={() => { setViewed(false); setError(copy.error) }} />
          <div className="atelier-actions">
            <button type="button" className="atelier-button" disabled={!viewed} onClick={download}>{copy.download}</button>
            <button type="button" className="atelier-secondary" disabled={!viewed} onClick={() => void share()}>{copy.share}</button>
          </div>
        </div> : null}
        {job.status !== 'submitted' ? <button type="button" onClick={() => { setJob(null); setApproved(false); setError('') }}>{copy.newClip}</button> : null}
      </>}
      <div className="atelier-actions">
        <button type="button" className="atelier-secondary" disabled={loading || submitting} onClick={() => void refresh()}>{copy.refresh}</button>
        <a href="/account">{copy.settings}</a>
        <button type="button" disabled={submitting} onClick={() => { setOpen(false); setApproved(false) }}>{copy.close}</button>
      </div>
      {jobs.length ? <details><summary>{copy.recent}</summary>
        {jobs.map(row => <button key={row.id} type="button" disabled={submitting} onClick={() => { setJob(row); setApproved(false); setError('') }}>
          {new Date(row.createdAt).toLocaleString(language)} · {row.status} · {row.credits}
        </button>)}
      </details> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div> : null}
  </section>
}

import { createHash } from 'crypto'
import { SharedStoryError } from './sharedStory'
import { RUNWAY_SHARE_CONSENT, RUNWAY_SHARE_CREDITS, RUNWAY_SHARE_MODEL, RUNWAY_SHARE_RATIO, RUNWAY_SHARE_SECONDS, validRunwayBrief, validRunwayFrame } from './runwayShareBrief'
import { runwayJob, reserveRunwayJob, runwayStoreReady, updateRunwayJob, writeRunwayVideo, RUNWAY_MAX_BYTES, type RunwayJob } from './runwayShareStore'
import { reserveAiAttempt } from './operations'

export function runwayConfiguration() {
  return { available: false, key: '', budget: 0, dailyCap: 0, reason: 'commercial-entitlement-required' }
}
export function runwayQuote() {
  return {
    available: runwayConfiguration().available, model: RUNWAY_SHARE_MODEL,
    seconds: RUNWAY_SHARE_SECONDS, ratio: RUNWAY_SHARE_RATIO, credits: RUNWAY_SHARE_CREDITS,
    estimatedUsd: RUNWAY_SHARE_CREDITS * 0.01, pricingCheckedAt: '2026-11-03',
    consentVersion: RUNWAY_SHARE_CONSENT, disabledReason: runwayConfiguration().reason
  }
}
function configured() {
  const config = runwayConfiguration()
  if (!config.available) throw new SharedStoryError('Runway generation and provider status checks are disabled pending commercial entitlement review.', 503)
  return config
}
export function runwayIdentifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new SharedStoryError('Invalid cinematic request ID.', 400)
  }
  return value.toLowerCase()
}
export function parseRunwayRequest(body: unknown) {
  if (!body || typeof body !== 'object') throw new SharedStoryError('Invalid cinematic request.', 400)
  const input = body as Record<string, unknown>
  if (!validRunwayBrief(input.brief)) throw new SharedStoryError('Write a visual brief of 40–900 characters.', 400)
  if (!validRunwayFrame(input.frame)) throw new SharedStoryError('The generated starting illustration is invalid.', 400)
  if (input.approved !== true || input.consentVersion !== RUNWAY_SHARE_CONSENT || input.approvedCredits !== RUNWAY_SHARE_CREDITS) {
    throw new SharedStoryError('Review the Runway disclosure and current cost before approving paid generation.', 403)
  }
  return { id: runwayIdentifier(input.id), brief: input.brief.trim(), frame: input.frame }
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
async function provider(path: string, method: 'GET' | 'POST', body?: unknown): Promise<Record<string, unknown>> {
  const config = configured()
  try {
    const response = await fetch(`https://api.dev.runwayml.com/v1/${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${config.key}`, 'X-Runway-Version': '2024-11-06', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
    if (!response.ok) throw new Error('Provider rejected request')
    const data: unknown = await response.json()
    if (!object(data)) throw new Error('Invalid provider response')
    return data
  } catch {
    console.error(JSON.stringify({ event: 'runway-provider-failure' }))
    throw new SharedStoryError('Runway could not complete this request. No paid generation is retried automatically; the reservation remains counted. Check the saved job or your Runway dashboard.', 502)
  }
}
export function publicRunwayJob(job: RunwayJob) {
  return { id: job.id, status: job.status, credits: job.credits, createdAt: job.created_at,
    ...(job.status === 'reserved' ? { status: 'unknown' as const } : {}) }
}
export async function createRunwayJob(owner: string, body: unknown) {
  const input = parseRunwayRequest(body)
  const config = configured()
  await runwayStoreReady()
  const fingerprint = createHash('sha256').update(JSON.stringify({
    brief: input.brief, frame: createHash('sha256').update(input.frame).digest('hex'),
    model: RUNWAY_SHARE_MODEL, seconds: RUNWAY_SHARE_SECONDS, ratio: RUNWAY_SHARE_RATIO
  })).digest('hex')
  const reservation = await reserveRunwayJob({
    id: input.id, owner_id: owner, fingerprint, credits: RUNWAY_SHARE_CREDITS,
    created_at: new Date().toISOString(), status: 'reserved', task_id: null
  }, config.budget, config.dailyCap)
  if (!reservation.reserved) return publicRunwayJob(reservation.job)
  const job = reservation.job
  try {
    await reserveAiAttempt()
  } catch (error) {
    await updateRunwayJob({ ...job, status: 'failed' })
    throw error
  }
  let taskId: string
  try {
    const data = await provider('image_to_video', 'POST', {
      model: RUNWAY_SHARE_MODEL, promptText: input.brief,
      promptImage: { uri: input.frame, position: 'first' },
      duration: RUNWAY_SHARE_SECONDS, ratio: RUNWAY_SHARE_RATIO
    })
    if (typeof data.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id)) {
      throw new SharedStoryError('Runway returned an unconfirmed task. This reservation will not be submitted again automatically.', 502)
    }
    taskId = runwayIdentifier(data.id)
  } catch (error) {
    await updateRunwayJob({ ...job, status: 'unknown' })
    throw error
  }
  // Once submitted, never call generation again, even if this persistence step fails.
  await updateRunwayJob({ ...job, status: 'submitted', task_id: taskId })
  return publicRunwayJob({ ...job, status: 'submitted', task_id: taskId })
}
export function runwayOutputUrl(value: unknown): string {
  if (typeof value !== 'string') throw new SharedStoryError('Invalid cinematic output.', 502)
  const url = new URL(value)
  // Official Runway output host. No arbitrary URLs, credentials or redirects.
  if (url.protocol !== 'https:' || url.hostname !== 'dnznrvs05pmza.cloudfront.net' ||
    url.port || url.username || url.password) throw new SharedStoryError('Unexpected cinematic output host.', 502)
  return url.href
}
async function downloadOutput(url: string): Promise<Uint8Array> {
  const response = await fetch(runwayOutputUrl(url), { redirect: 'error', signal: AbortSignal.timeout(25000) })
  if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > RUNWAY_MAX_BYTES) {
    await response.body?.cancel()
    throw new SharedStoryError('Could not save the cinematic output.', 502)
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > RUNWAY_MAX_BYTES) throw new SharedStoryError('Cinematic output exceeds the 30 MB limit.', 502)
      chunks.push(value)
    }
  } finally { await reader.cancel() }
  const bytes = Buffer.concat(chunks)
  if (bytes.length < 12 || bytes.subarray(4, 8).toString() !== 'ftyp') throw new SharedStoryError('The cinematic output is not a valid MP4.', 502)
  return bytes
}
export async function refreshRunwayJob(owner: string, id: string) {
  const job = await runwayJob(owner, id)
  if (job.status !== 'submitted' || !job.task_id) return publicRunwayJob(job)
  const data = await provider(`tasks/${runwayIdentifier(job.task_id)}`, 'GET')
  if (runwayIdentifier(data.id) !== job.task_id) throw new SharedStoryError('Unexpected cinematic task response.', 502)
  if (['PENDING', 'RUNNING', 'THROTTLED'].includes(String(data.status))) return publicRunwayJob(job)
  if (data.status === 'FAILED' || data.status === 'CANCELED') {
    await updateRunwayJob({ ...job, status: 'failed' })
    return publicRunwayJob({ ...job, status: 'failed' })
  }
  if (data.status !== 'SUCCEEDED' || !Array.isArray(data.output) || !data.output.length) {
    throw new SharedStoryError('Invalid cinematic task status.', 502)
  }
  // Save ephemeral provider output privately before advertising success.
  const bytes = await downloadOutput(runwayOutputUrl(data.output[0]))
  await writeRunwayVideo(job, bytes)
  await updateRunwayJob({ ...job, status: 'ready' })
  return publicRunwayJob({ ...job, status: 'ready' })
}

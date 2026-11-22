import { createHmac, timingSafeEqual } from 'crypto'
import { consumeOperation } from './operationsStore'
import { SharedStoryError } from './sharedStory'

export const HEYGEN_REEL_CONSENT = 'heygen-reel-2026-11'
export const HEYGEN_REEL_RESERVATION_CENTS = 36
const PILOT_ATTEMPTS = Math.floor(1000 / HEYGEN_REEL_RESERVATION_CENTS)
const TOKEN_AGE = 24 * 60 * 60 * 1000

function key() {
  const value = process.env.HEYGEN_API_KEY?.trim()
  if (!value) throw new SharedStoryError('HeyGen is not configured. Add the API key on the server.', 503)
  return value
}

function requirePilotApproval() {
  if (process.env.HEYGEN_REEL_PROVIDER_APPROVED !== 'true') {
    throw new SharedStoryError('HeyGen reels are disabled until provider terms, privacy, and the pilot budget are approved by the operator.', 503)
  }
}

function signature(value: string) {
  return createHmac('sha256', key()).update(`muse-heygen-reel:${value}`).digest('base64url')
}

function token(owner: string, id: string) {
  const payload = Buffer.from(JSON.stringify({ owner, id, expires: Date.now() + TOKEN_AGE })).toString('base64url')
  return `${payload}.${signature(payload)}`
}

function tokenId(owner: string, value: unknown): string {
  if (typeof value !== 'string' || value.length > 1024) throw new SharedStoryError('Invalid reel reference.', 400)
  const parts = value.split('.')
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) {
    throw new SharedStoryError('Invalid reel reference.', 400)
  }
  const expected = Buffer.from(signature(parts[0]))
  const supplied = Buffer.from(parts[1])
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new SharedStoryError('Invalid reel reference.', 403)
  let payload: unknown
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) } catch {
    throw new SharedStoryError('Invalid reel reference.', 400)
  }
  if (!payload || typeof payload !== 'object') throw new SharedStoryError('Invalid reel reference.', 400)
  const item = payload as Record<string, unknown>
  if (item.owner !== owner || typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(item.id) ||
      typeof item.expires !== 'number' || item.expires <= Date.now()) {
    throw new SharedStoryError('Reel reference expired or does not belong to this account.', 403)
  }
  return item.id
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

async function provider(path: string, init: RequestInit = {}) {
  let response: Response
  try {
    response = await fetch(`https://api.heygen.com${path}`, {
      ...init, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { 'X-Api-Key': key(), ...init.headers }
    })
  } catch {
    throw new SharedStoryError('HeyGen did not confirm the request. Do not retry automatically; check your HeyGen usage first.', 502)
  }
  if (!response.ok) throw new SharedStoryError('HeyGen could not process the request. Check the API key, credits, and usage before trying again.', 502)
  const body: unknown = await response.json().catch(() => null)
  if (!object(body) || !object(body.data)) throw new SharedStoryError('HeyGen returned an invalid response. Check usage before retrying.', 502)
  return body.data
}

export async function createHeygenReel(owner: string, body: unknown) {
  requirePilotApproval()
  key()
  if (!object(body) || body.approved !== true || body.consentVersion !== HEYGEN_REEL_CONSENT ||
      typeof body.prompt !== 'string' || body.prompt.trim().length < 20 || body.prompt.length > 4000 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body.prompt) ||
      typeof body.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id) ||
      typeof body.created !== 'number' || !Number.isSafeInteger(body.created) ||
      Math.abs(Date.now() - body.created) > 10 * 60 * 1000) {
    throw new SharedStoryError('Review the reel prompt and approve the HeyGen disclosure before generating.', 400)
  }
  const requestKey = createHmac('sha256', key()).update(`${owner}:${body.id}`).digest('hex')
  const duplicate = await consumeOperation(`heygen-request:${requestKey}`, 1, new Date(Date.now() + TOKEN_AGE).toISOString())
  if (!duplicate.allowed) throw new SharedStoryError('This reel request was already submitted. Check your HeyGen usage; it was not submitted again.', 409)
  const day = new Date(Date.now()).toISOString().slice(0, 10)
  const accountHash = createHmac('sha256', key()).update(`reel-owner:${owner}`).digest('hex')
  const daily = await consumeOperation(`heygen-day:${day}:${accountHash}`, 2, `${day}T23:59:59.999Z`)
  if (!daily.allowed) throw new SharedStoryError('The daily reel limit for this account has been reached. Try again tomorrow (UTC).', 429)
  const budget = await consumeOperation('heygen-reel-pilot-v1', PILOT_ATTEMPTS, '9999-12-31T23:59:59.000Z')
  if (!budget.allowed) throw new SharedStoryError('The $10 HeyGen pilot reservation limit has been reached.', 429)
  const result = await provider('/v3/models/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey },
    body: JSON.stringify({
      model: 'heygen-video-1', mode: 'text_to_video',
      prompt: `${body.prompt.trim()}\nVertical cinematic storybook scene. No text, captions, logos, or identifiable real people.`,
      duration: 10, resolution: '768p', aspect_ratio: '9:16'
    })
  })
  if (typeof result.video_id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(result.video_id)) {
    throw new SharedStoryError('HeyGen did not confirm the reel ID. Check usage before retrying.', 502)
  }
  return { token: token(owner, result.video_id), status: 'pending' }
}

export async function heygenReelStatus(owner: string, reference: unknown) {
  const id = tokenId(owner, reference)
  const data = await provider(`/v3/models/videos/${encodeURIComponent(id)}`)
  if (!['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(String(data.status))) {
    throw new SharedStoryError('HeyGen returned an unknown reel status.', 502)
  }
  return { status: String(data.status), url: data.video_url }
}

export async function downloadHeygenReel(owner: string, reference: unknown) {
  const result = await heygenReelStatus(owner, reference)
  if (result.status !== 'completed' || typeof result.url !== 'string') throw new SharedStoryError('The reel is not ready yet.', 409)
  let url: URL
  try { url = new URL(result.url) } catch { throw new SharedStoryError('HeyGen returned an invalid video address.', 502) }
  if (url.protocol !== 'https:' || !['resource.heygen.ai', 'resource2.heygen.ai'].includes(url.hostname) ||
      url.port || url.username || url.password) throw new SharedStoryError('HeyGen returned an unexpected video host.', 502)
  let response: Response
  try { response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) }) } catch {
    throw new SharedStoryError('Could not download the reel from HeyGen. Try again.', 502)
  }
  const maxBytes = 30 * 1024 * 1024
  if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > maxBytes) {
    await response.body?.cancel()
    throw new SharedStoryError('HeyGen returned an invalid or oversized video.', 502)
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) throw new SharedStoryError('HeyGen returned an oversized video.', 502)
      chunks.push(value)
    }
  } finally { await reader.cancel() }
  const bytes = Buffer.concat(chunks)
  if (bytes.length < 12 || bytes.toString('ascii', 4, 8) !== 'ftyp') throw new SharedStoryError('HeyGen returned an invalid MP4.', 502)
  return bytes
}

export function heygenConfigured() {
  return Boolean(process.env.HEYGEN_API_KEY?.trim()) && process.env.HEYGEN_REEL_PROVIDER_APPROVED === 'true'
}

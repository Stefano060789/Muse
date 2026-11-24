import { createHmac, timingSafeEqual } from 'crypto'
import { consumeOperation, consumeOperationUnits } from './operationsStore'
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

function tokenId(owner: string, value: unknown, allowExpired = false): string {
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
      typeof item.expires !== 'number' || (!allowExpired && item.expires <= Date.now())) {
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

export function heygenReferenceReservation() {
  const cents = Number(process.env.HEYGEN_REEL_REFERENCE_RESERVATION_CENTS)
  return process.env.HEYGEN_REEL_REFERENCE_APPROVED === 'true' && Number.isInteger(cents) && cents >= 50 && cents <= 1000
    ? Math.ceil(cents / HEYGEN_REEL_RESERVATION_CENTS) * HEYGEN_REEL_RESERVATION_CENTS : null
}

function referencePhotos(value: unknown): { mime: string; bytes: Buffer; role: 'protagonist' | 'element' }[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 3) throw new SharedStoryError('Choose up to three reference photos.', 400)
  let protagonist = false
  return value.map(photo => {
    if (!object(photo) || typeof photo.mime !== 'string' || typeof photo.data !== 'string' ||
        (photo.role !== 'protagonist' && photo.role !== 'element') ||
        !['image/png', 'image/jpeg'].includes(photo.mime) ||
        photo.data.length > 1024 * 1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(photo.data)) {
      throw new SharedStoryError('Reference photos must be PNG or JPEG and at most 700 KB each.', 400)
    }
    const bytes = Buffer.from(photo.data, 'base64')
    if (photo.role === 'protagonist') {
      if (protagonist) throw new SharedStoryError('Choose only one protagonist photo.', 400)
      protagonist = true
    }
    if (!bytes.length || bytes.length > 700 * 1024 ||
        (photo.mime === 'image/png' && !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) ||
        (photo.mime === 'image/jpeg' && !(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff))) {
      throw new SharedStoryError('Reference photos must be valid PNG or JPEG files under 700 KB.', 400)
    }
    return { mime: photo.mime, bytes, role: photo.role }
  })
}

export async function deleteHeygenAsset(asset: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(asset)) throw new SharedStoryError('Invalid provider asset reference.', 503)
  let response: Response
  try {
    response = await fetch(`https://api.heygen.com/v3/assets/${encodeURIComponent(asset)}`, {
      method: 'DELETE', headers: { 'X-Api-Key': key() }, redirect: 'error', signal: AbortSignal.timeout(20000)
    })
  } catch {
    throw new SharedStoryError('HeyGen photo cleanup failed; it will be retried.', 502)
  }
  if (!response.ok && response.status !== 404) throw new SharedStoryError('HeyGen photo cleanup failed; it will be retried.', 502)
}

export function validateHeygenReelRequest(body: unknown) {
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
  const photos = referencePhotos(body.photos)
  const photoReservation = photos.length ? heygenReferenceReservation() : null
  if (photos.length && (!photoReservation || body.photoApproved !== true)) {
    throw new SharedStoryError('Reference photos are unavailable until their privacy, cleanup and pricing controls are approved.', 503)
  }
  return { body: { ...body, prompt: body.prompt, id: body.id }, photos, photoReservation }
}

export async function createHeygenReel(owner: string, value: unknown, registerAsset?: (id: string) => Promise<void>) {
  const { body, photos, photoReservation } = validateHeygenReelRequest(value)
  if (photos.length && !registerAsset) throw new SharedStoryError('Private photo cleanup is not configured.', 503)
  const requestKey = createHmac('sha256', key()).update(`${owner}:${body.id}`).digest('hex')
  const duplicate = await consumeOperation(`heygen-request:${requestKey}`, 1, new Date(Date.now() + TOKEN_AGE).toISOString())
  if (!duplicate.allowed) throw new SharedStoryError('This reel request was already submitted. Check your HeyGen usage; it was not submitted again.', 409)
  const day = new Date(Date.now()).toISOString().slice(0, 10)
  const accountHash = createHmac('sha256', key()).update(`reel-owner:${owner}`).digest('hex')
  const daily = await consumeOperation(`heygen-day:${day}:${accountHash}`, 2, `${day}T23:59:59.999Z`)
  if (!daily.allowed) throw new SharedStoryError('The daily reel limit for this account has been reached. Try again tomorrow (UTC).', 429)
  const units = photoReservation ? photoReservation / HEYGEN_REEL_RESERVATION_CENTS : 1
  const budget = units === 1
    ? await consumeOperation('heygen-reel-pilot-v1', PILOT_ATTEMPTS, '9999-12-31T23:59:59.000Z')
    : await consumeOperationUnits('heygen-reel-pilot-v1', PILOT_ATTEMPTS, '9999-12-31T23:59:59.000Z', units)
  if (!budget.allowed) throw new SharedStoryError('The $10 HeyGen pilot reservation limit has been reached.', 429)
  let registerQueue = Promise.resolve()
  const uploads = await Promise.allSettled(photos.map(async (photo, index) => {
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(photo.bytes)], { type: photo.mime }),
      `reference-${index + 1}.${photo.mime === 'image/png' ? 'png' : 'jpg'}`)
    const data = await provider('/v3/assets', {
      method: 'POST', headers: { 'Idempotency-Key': `${requestKey}-${index}` }, body: form
    })
    if (typeof data.asset_id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.asset_id)) {
      throw new SharedStoryError('HeyGen did not confirm a photo asset. Operator review is required.', 502)
    }
    const asset = data.asset_id
    registerQueue = registerQueue.catch(() => undefined).then(() => registerAsset!(asset))
    await registerQueue
    return asset
  }))
  const failedUpload = uploads.find(result => result.status === 'rejected')
  if (failedUpload?.status === 'rejected') {
    console.error(JSON.stringify({ event: 'heygen-photo-upload-unconfirmed-review-assets' }))
    throw new SharedStoryError('Photo upload could not be confirmed. Do not retry until the operator checks HeyGen assets.', 502)
  }
  const assets = uploads.map(result => result.status === 'fulfilled' ? result.value : '')
  const result = await provider('/v3/models/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey },
    body: JSON.stringify({
      model: 'heygen-video-1', mode: photos.length ? 'reference_to_video' : 'text_to_video',
      prompt: `${body.prompt.trim()}\nVertical cinematic storybook scene. No text, captions, or logos.${photos.length
        ? ` ${photos.map((photo, index) => photo.role === 'protagonist'
          ? `Use <Picture ${index + 1}> as the protagonist's visual reference.`
          : `Use <Picture ${index + 1}> as a visual reference for an element in the scene.`).join(' ')}`
        : ' No identifiable real people.'}`,
      ...(assets.length ? { reference_images: assets.map(asset => ({ type: 'asset_id', asset_id: asset })) } : {}),
      duration: 10, resolution: '768p', aspect_ratio: '9:16'
    })
  })
  if (typeof result.video_id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(result.video_id)) {
    throw new SharedStoryError('HeyGen did not confirm the reel ID. Check usage before retrying.', 502)
  }
  return { token: token(owner, result.video_id), status: 'pending' }
}

export async function heygenReelStatus(owner: string, reference: unknown, allowExpired = false) {
  const id = tokenId(owner, reference, allowExpired)
  const data = await provider(`/v3/models/videos/${encodeURIComponent(id)}`)
  if (!['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(String(data.status))) {
    throw new SharedStoryError('HeyGen returned an unknown reel status.', 502)
  }
  return { status: String(data.status), url: data.video_url }
}

export async function downloadHeygenReel(owner: string, reference: unknown, allowExpired = false) {
  const result = await heygenReelStatus(owner, reference, allowExpired)
  if (result.status !== 'completed' || typeof result.url !== 'string') throw new SharedStoryError('The reel is not ready yet.', 409)
  return downloadHeygenVideo(result.url)
}

export async function downloadHeygenVideo(value: unknown) {
  if (typeof value !== 'string') throw new SharedStoryError('The reel is not ready yet.', 409)
  let url: URL
  try { url = new URL(value) } catch { throw new SharedStoryError('HeyGen returned an invalid video address.', 502) }
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

import { SharedStoryError } from './sharedStory'

// Browser-safe media rules shared by the creator form and the server. The
// server re-validates every declaration and the stored bytes; the client copy
// only avoids paid generation for a file that would be rejected anyway.
const MB = 1024 * 1024
export const SHARED_MEDIA_PHOTO_MAX_BYTES = 5 * MB
export const SHARED_MEDIA_VIDEO_MAX_BYTES = 20 * MB
export const SHARED_MEDIA_TYPES = {
  'image/jpeg': { kind: 'photo', ext: 'jpg', max: SHARED_MEDIA_PHOTO_MAX_BYTES },
  'image/png': { kind: 'photo', ext: 'png', max: SHARED_MEDIA_PHOTO_MAX_BYTES },
  'image/webp': { kind: 'photo', ext: 'webp', max: SHARED_MEDIA_PHOTO_MAX_BYTES },
  'video/mp4': { kind: 'video', ext: 'mp4', max: SHARED_MEDIA_VIDEO_MAX_BYTES },
  'video/webm': { kind: 'video', ext: 'webm', max: SHARED_MEDIA_VIDEO_MAX_BYTES }
} as const
export type SharedMediaMime = keyof typeof SHARED_MEDIA_TYPES
export type SharedMediaKind = 'photo' | 'video'
export const SHARED_MEDIA_ACCEPT = Object.keys(SHARED_MEDIA_TYPES).join(',')
export const SHARED_MEDIA_UPLOAD_WINDOW_MS = 15 * 60 * 1000
export const SHARED_VOICE_UPLOAD_WINDOW_MS = SHARED_MEDIA_UPLOAD_WINDOW_MS
// Abandoned pending uploads are purged this long after their window closes.
export const SHARED_MEDIA_PENDING_GRACE_MS = 5 * 60 * 1000
export const SHARED_MEDIA_ATTEMPTS_PER_STORY = 6
export const SHARED_VOICE_ATTEMPTS_PER_STORY = 6
export const SHARED_VOICE_MAX_BYTES = 5 * MB
export const SHARED_VOICE_MAX_SECONDS = 60
export const SHARED_MEDIA_DOWNLOAD_TTL_SECONDS = 600
export const SHARED_MEDIA_BUCKET = 'muse-shared-media'
export const SHARED_MEDIA_KEY_PATTERN = /^stories\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp|mp4|webm|wav|mp3)$/

export type SharedMediaDeclaration = { mime: SharedMediaMime; size: number; kind: SharedMediaKind; ext: string }
export type SharedMediaSummary = { kind: SharedMediaKind; mime: SharedMediaMime; size: number }
export type SharedMediaRecord = {
  id: string
  story_id: string
  object_key: string
  kind: SharedMediaKind
  mime: SharedMediaMime
  size: number
  status: 'pending' | 'ready'
  upload_hash: string
  upload_expires_at: string
  created_at: string
}
export type SharedVoiceRecord = Omit<SharedMediaRecord, 'kind' | 'mime'> & { kind: 'voice'; mime: 'audio/wav' }
export type SharedVoiceSummary = { mime: 'audio/wav'; size: number }
export type SharedGiftReply = { message: string; createdAt: string }

export function formatMediaSize(bytes: number): string {
  return bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function parseMediaDeclaration(value: unknown): SharedMediaDeclaration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SharedStoryError('Describe the photo or video with its type and size.')
  const input = value as Record<string, unknown>
  if (Object.keys(input).some(key => key !== 'mime' && key !== 'size')) throw new SharedStoryError('Only the photo or video type and size are accepted.')
  const mime = typeof input.mime === 'string' && Object.prototype.hasOwnProperty.call(SHARED_MEDIA_TYPES, input.mime) ? input.mime as SharedMediaMime : null
  if (!mime) throw new SharedStoryError('Choose one JPEG, PNG or WebP photo, or one MP4 or WebM video.', 415)
  const rule = SHARED_MEDIA_TYPES[mime]
  if (!Number.isSafeInteger(input.size) || Number(input.size) < 1) throw new SharedStoryError('The selected file is empty or its size is unknown.')
  if (Number(input.size) > rule.max) {
    throw new SharedStoryError(`${rule.kind === 'photo' ? 'Photos' : 'Videos'} can be at most ${formatMediaSize(rule.max)}. This file is ${formatMediaSize(Number(input.size))}.`, 413)
  }
  return { mime, size: Number(input.size), kind: rule.kind, ext: rule.ext }
}

export function parseVoiceDeclaration(value: unknown): { mime: 'audio/wav'; size: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SharedStoryError('Describe the voice recording with its type and size.')
  }
  const input = value as Record<string, unknown>
  if (Object.keys(input).some(key => key !== 'mime' && key !== 'size')) {
    throw new SharedStoryError('Only the voice recording type and size are accepted.')
  }
  if (input.mime !== 'audio/wav') throw new SharedStoryError('Choose a WAV audio recording.', 415)
  if (!Number.isSafeInteger(input.size) || Number(input.size) < 1) {
    throw new SharedStoryError('The selected recording is empty or its size is unknown.')
  }
  if (Number(input.size) > SHARED_VOICE_MAX_BYTES) {
    throw new SharedStoryError(`Voice recordings can be at most ${formatMediaSize(SHARED_VOICE_MAX_BYTES)}.`, 413)
  }
  return { mime: 'audio/wav', size: Number(input.size) }
}

export function parseWavDuration(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const text = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length))
  if (bytes.length < 44 || text(0, 4) !== 'RIFF' || text(8, 4) !== 'WAVE' ||
      view.getUint32(4, true) + 8 !== bytes.length) {
    throw new SharedStoryError('The voice recording is not a complete WAV file.', 415)
  }
  let format: { code: number; channels: number; sampleRate: number; byteRate: number; blockAlign: number; bits: number } | null = null
  let dataLength: number | null = null
  let offset = 12
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new SharedStoryError('The voice recording has a malformed WAV chunk.', 415)
    const chunk = text(offset, 4)
    const size = view.getUint32(offset + 4, true)
    const start = offset + 8
    const end = start + size
    if (end + (size & 1) > bytes.length) throw new SharedStoryError('The voice recording has a malformed WAV chunk.', 415)
    if (chunk === 'fmt ') {
      if (format || size < 16) throw new SharedStoryError('The voice recording has an unsupported WAV format.', 415)
      format = {
        code: view.getUint16(start, true), channels: view.getUint16(start + 2, true),
        sampleRate: view.getUint32(start + 4, true), byteRate: view.getUint32(start + 8, true),
        blockAlign: view.getUint16(start + 12, true), bits: view.getUint16(start + 14, true)
      }
    } else if (chunk === 'data') {
      if (dataLength !== null) throw new SharedStoryError('The voice recording has multiple WAV audio streams.', 415)
      dataLength = size
    }
    offset = end + (size & 1)
  }
  if (!format || dataLength === null || format.code !== 1 || format.channels < 1 || format.channels > 2 ||
      ![8, 16, 24, 32].includes(format.bits) || format.sampleRate < 8000 || format.sampleRate > 96000 ||
      format.blockAlign !== format.channels * format.bits / 8 ||
      format.byteRate !== format.sampleRate * format.blockAlign || dataLength < format.blockAlign ||
      dataLength % format.blockAlign !== 0) {
    throw new SharedStoryError('Use a valid PCM WAV recording.', 415)
  }
  const duration = dataLength / format.byteRate
  if (!Number.isFinite(duration) || duration <= 0 || duration > SHARED_VOICE_MAX_SECONDS) {
    throw new SharedStoryError('Voice recordings can be at most 60 seconds long.', 413)
  }
  return duration
}

export function validateVoiceBytes(bytes: Uint8Array): SharedVoiceSummary & { durationSeconds: number } {
  if (bytes.length < 1 || bytes.length > SHARED_VOICE_MAX_BYTES) {
    throw new SharedStoryError(`Voice recordings must be between 1 byte and ${formatMediaSize(SHARED_VOICE_MAX_BYTES)}.`, 413)
  }
  return {
    mime: 'audio/wav',
    size: bytes.length,
    durationSeconds: parseWavDuration(bytes)
  }
}

const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...Array.from(bytes.subarray(start, start + length)))
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'M4V ', 'mmp4', 'f4v '])

// Declared browser MIME types are untrusted, so the stored bytes are sniffed.
// HEIC/AVIF/QuickTime share the ISO container but use other brands and are rejected.
export function mediaSignatureMatches(head: Uint8Array, mime: SharedMediaMime): boolean {
  switch (mime) {
    case 'image/jpeg': return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
    case 'image/png': return head.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => head[index] === byte)
    case 'image/webp': return head.length >= 12 && ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP'
    case 'video/mp4': return head.length >= 12 && ascii(head, 4, 4) === 'ftyp' && MP4_BRANDS.has(ascii(head, 8, 4))
    case 'video/webm': return head.length >= 8 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3 &&
      ascii(head, 0, Math.min(head.length, 4096)).includes('webm')
    default: return false
  }
}

export function mediaSummary(record: Pick<SharedMediaRecord, 'kind' | 'mime' | 'size'> | null | undefined): SharedMediaSummary | null {
  return record ? { kind: record.kind, mime: record.mime, size: Number(record.size) } : null
}

export function voiceSummary(record: Pick<SharedVoiceRecord, 'mime' | 'size'> | null | undefined): SharedVoiceSummary | null {
  return record ? { mime: record.mime, size: Number(record.size) } : null
}
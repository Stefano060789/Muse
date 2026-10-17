import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, chmodSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { NARRATION_PRESETS, NARRATION_STYLES, type NarrationStyle } from './narration'
import { SharedStoryError } from './sharedStory'
import { googleHostedConfigured, googleHostedOperation } from './googleNarrationHosted'

const RETENTION = 30 * 86400000
const MAX_AUDIO = 12 * 1024 * 1024
const MAX_CACHE = 128 * 1024 * 1024
// Names verified against Google's supported-voices catalog; never fall back across languages.
const VOICES: Record<string, [string, string]> = {
  'en-us': ['en-US', 'en-US-Wavenet-F'], 'zh-cn': ['cmn-CN', 'cmn-CN-Wavenet-A'],
  'cmn-cn': ['cmn-CN', 'cmn-CN-Wavenet-A'], 'hi-in': ['hi-IN', 'hi-IN-Wavenet-A'],
  'es-es': ['es-ES', 'es-ES-Wavenet-F'], 'ar-sa': ['ar-XA', 'ar-XA-Wavenet-A'],
  'ar-xa': ['ar-XA', 'ar-XA-Wavenet-A'], 'it-it': ['it-IT', 'it-IT-Wavenet-E'],
  'fr-fr': ['fr-FR', 'fr-FR-Wavenet-F'], 'de-de': ['de-DE', 'de-DE-Wavenet-G'],
  'ja-jp': ['ja-JP', 'ja-JP-Wavenet-A'], 'pt-br': ['pt-BR', 'pt-BR-Wavenet-A']
}

function failure(code: string, message: string, status = 503): SharedStoryError & { code: string } {
  return Object.assign(new SharedStoryError(message, status), { code })
}

export function googleNarrationConfiguration() {
  const raw = process.env.MUSE_GOOGLE_TTS_BUDGET_CHARACTERS || ''
  const budgetCharacters = /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : 0
  const reason = process.env.NEXT_PUBLIC_NARRATION_PROVIDER !== 'google' ? 'disabled'
    : !process.env.GOOGLE_TTS_API_KEY?.trim() ? 'missing-key'
      : !budgetCharacters ? 'missing-budget'
        : (process.env.VERCEL || process.env.STORY_STORAGE === 'supabase') &&
          !googleHostedConfigured() ? 'hosted-storage-required' : null
  return { available: reason === null, reason, provider: 'google' as const, budgetCharacters, budget: budgetCharacters,
    storage: googleHostedConfigured() ? 'supabase' as const : 'sqlite' as const,
    retentionDays: 30, maxCharacters: 12000, languages: Object.keys(VOICES) }
}

export function googleVoice(language: string, style: NarrationStyle) {
  if (typeof language !== 'string' || !Object.prototype.hasOwnProperty.call(VOICES, language.toLowerCase()) ||
      !NARRATION_STYLES.includes(style)) {
    throw failure('google-unsupported-voice', 'Unsupported Google narration language or style.', 400)
  }
  const [languageCode, name] = VOICES[language.toLowerCase()]
  return { languageCode, name, speakingRate: NARRATION_PRESETS[style].rate,
    pitch: style === 'playful' ? 0.5 : style === 'suspenseful' ? -0.5 : 0 }
}

function transaction<T>(run: (db: DatabaseSync) => T): T {
  let db: DatabaseSync | undefined
  let active = false
  try {
    const filename = resolve(process.env.MUSE_GOOGLE_TTS_SQLITE_PATH || 'data/google-tts.sqlite')
    mkdirSync(dirname(filename), { recursive: true, mode: 0o700 })
    const { DatabaseSync: Sqlite } = require('node:sqlite') as typeof import('node:sqlite')
    db = new Sqlite(filename)
    chmodSync(filename, 0o600)
    db.exec(`PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS google_tts_budget (id INTEGER PRIMARY KEY CHECK(id=1), used INTEGER NOT NULL);
      INSERT OR IGNORE INTO google_tts_budget VALUES (1,0);
      CREATE TABLE IF NOT EXISTS google_tts_audio (
        hash TEXT PRIMARY KEY, status TEXT NOT NULL, expires INTEGER NOT NULL, audio BLOB
      );
      BEGIN IMMEDIATE;`)
    active = true
    db.prepare('UPDATE google_tts_audio SET audio=NULL WHERE expires<=? AND audio IS NOT NULL').run(Date.now())
    const result = run(db)
    db.exec('COMMIT')
    active = false
    return result
  } catch (error) {
    if (error instanceof SharedStoryError) throw error
    throw failure('google-storage-unavailable', 'Google narration safety storage is unavailable.')
  } finally {
    try { if (active) db?.exec('ROLLBACK') } finally { db?.close() }
  }
}

function chunks(text: string): string[] {
  const result: string[] = []
  let part = '', bytes = 0
  for (const point of text) {
    const size = Buffer.byteLength(point, 'utf8')
    if (bytes + size > 4900) {
      // Prefer a sentence/word boundary, but also support languages without spaces.
      const boundary = Math.max(part.lastIndexOf(' '), part.lastIndexOf('\n'), part.lastIndexOf('。') + 1)
      const cut = boundary > part.length / 2 ? boundary : part.length
      result.push(part.slice(0, cut))
      part = part.slice(cut)
      bytes = Buffer.byteLength(part, 'utf8')
    }
    part += point
    bytes += size
  }
  if (part) result.push(part)
  return result
}

// Strip independent ID3 tags and accept only complete, compatible MPEG Layer III frames.
function mp3Frames(data: Buffer): { bytes: Buffer; format: string } {
  let offset = 0, end = data.length, format = ''
  if (data.subarray(0, 3).toString() === 'ID3') {
    if (data.length < 10 || data[3] < 2 || data[3] > 4 || data.subarray(6, 10).some(v => v > 127)) {
      throw failure('google-invalid-audio', 'Google returned invalid MP3 audio.')
    }
    offset = 10 + data.subarray(6, 10).reduce((size, v) => size * 128 + v, 0) + ((data[5] & 16) ? 10 : 0)
  }
  if (end >= 128 && data.subarray(end - 128, end - 125).toString() === 'TAG') end -= 128
  let start = offset
  while (offset + 4 <= end) {
    const a = data[offset], b = data[offset + 1], c = data[offset + 2], d = data[offset + 3]
    const version = (b >> 3) & 3, rateIndex = (c >> 2) & 3, bitrateIndex = c >> 4
    if (a !== 255 || (b & 224) !== 224 || version === 1 || ((b >> 1) & 3) !== 1 ||
        rateIndex === 3 || bitrateIndex === 0 || bitrateIndex === 15) break
    const rate = [44100, 48000, 32000][rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4)
    const bitrate = (version === 3
      ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
      : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])[bitrateIndex]
    const size = Math.floor((version === 3 ? 144000 : 72000) * bitrate / rate) + ((c >> 1) & 1)
    const current = `${version}:${rate}:${d >> 6}`
    if (offset + size > end || (format && current !== format)) break
    format = current
    if (offset === start) {
      const mono = (d >> 6) === 3
      const sideInfo = version === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17)
      const markerOffset = offset + 4 + ((b & 1) ? 0 : 2) + sideInfo
      const marker = data.subarray(markerOffset, markerOffset + 4).toString('ascii')
      const vbri = data.subarray(offset + 36, offset + 40).toString('ascii')
      // Per-file seek/duration headers become incorrect when independently encoded chunks are joined.
      if (marker === 'Xing' || marker === 'Info' || vbri === 'VBRI') start = offset + size
    }
    offset += size
  }
  if (!format || offset !== end || start === end) throw failure('google-invalid-audio', 'Google returned invalid MP3 audio.')
  return { bytes: data.subarray(start, end), format }
}

async function providerChunk(text: string, voice: ReturnType<typeof googleVoice>, signal: AbortSignal) {
  const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': process.env.GOOGLE_TTS_API_KEY! },
    body: JSON.stringify({ input: { text }, voice: { languageCode: voice.languageCode, name: voice.name },
      audioConfig: { audioEncoding: 'MP3', speakingRate: voice.speakingRate, pitch: voice.pitch } })
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw failure('google-provider-failure', 'Google narration provider is unavailable. This request will not be retried.')
  }
  if (!/^application\/json\b/i.test(response.headers.get('content-type') || '') || !response.body) {
    await response.body?.cancel()
    throw failure('google-invalid-audio', 'Google returned an invalid audio response.')
  }
  const reader = response.body.getReader()
  const parts: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 8 * 1024 * 1024) throw failure('google-audio-too-large', 'Google audio exceeds the safe response limit.')
      parts.push(value)
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  let audioContent: unknown
  try { audioContent = JSON.parse(Buffer.concat(parts).toString('utf8')).audioContent } catch {
    throw failure('google-invalid-audio', 'Google returned an invalid audio response.')
  }
  if (typeof audioContent !== 'string' || !audioContent.length || audioContent.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(audioContent) ||
      Buffer.from(audioContent, 'base64').toString('base64') !== audioContent) {
    throw failure('google-invalid-audio', 'Google returned invalid base64 audio.')
  }
  return mp3Frames(Buffer.from(audioContent, 'base64'))
}

export async function synthesizeGoogleNarration(
  text: string, language: string, style: NarrationStyle,
  options: { reserveAttempt?: () => Promise<void> } = {}
): Promise<Uint8Array> {
  const configuration = googleNarrationConfiguration()
  if (!configuration.available) throw failure('google-not-configured', 'Google narration requires an enabled provider, server key, explicit character budget and persistent private storage.')
  const voice = googleVoice(language, style)
  if (typeof text !== 'string' || text.length > 24000 || !text.trim() ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text) ||
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) {
    throw failure('google-invalid-text', 'Narration requires valid text (maximum 12000 Unicode characters).', 400)
  }
  const count = Array.from(text).length
  if (count > 12000) throw failure('google-invalid-text', 'Narration text exceeds 12000 Unicode characters.', 400)
  const hash = createHash('sha256').update(JSON.stringify(['google-mp3-v1', text, voice, style])).digest('hex')
  const hosted = googleHostedConfigured()
  const token = randomUUID()
  let cached: Uint8Array | null
  if (hosted) {
    const result = await googleHostedOperation('reserve', hash, token, count, configuration.budgetCharacters)
    if (result.status === 'pending') throw failure('google-request-pending', 'Narration is already reserved. Try playback later; no new paid request was made.', 409)
    if (result.status === 'failed') throw failure('google-request-failed', 'This paid narration request previously failed and will not be retried.', 409)
    if (result.status === 'exhausted') throw failure('google-budget-exhausted', 'Google narration lifetime character allowance is exhausted.', 429)
    if (result.status !== 'ready' && result.status !== 'reserved') throw failure('google-storage-unavailable', 'Invalid Google narration reservation.')
    cached = result.status === 'ready' ? mp3Frames(Buffer.from(result.audio!, 'base64')).bytes : null
  } else cached = transaction(db => {
    const row = db.prepare('SELECT status,expires,audio FROM google_tts_audio WHERE hash=?').get(hash)
    if (row?.status === 'ready' && row.audio && Number(row.expires) > Date.now()) return new Uint8Array(row.audio as Uint8Array)
    if (row?.status === 'pending') throw failure('google-request-pending', 'Narration is already reserved. Try playback later; no new paid request was made.', 409)
    if (row?.status === 'failed') throw failure('google-request-failed', 'This paid narration request previously failed and will not be retried.', 409)
    const used = Number(db.prepare('SELECT used FROM google_tts_budget WHERE id=1').get()!.used)
    if (!Number.isSafeInteger(used) || used < 0) throw failure('google-storage-unavailable', 'Google narration budget storage is invalid.')
    if (count > configuration.budgetCharacters - used) throw failure('google-budget-exhausted', 'Google narration lifetime character allowance is exhausted.', 429)
    db.prepare('UPDATE google_tts_budget SET used=used+? WHERE id=1').run(count)
    db.prepare("INSERT OR REPLACE INTO google_tts_audio VALUES (?, 'pending', ?, NULL)").run(hash, Date.now() + RETENTION)
    return null
  })
  if (cached) return cached
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  try {
    await options.reserveAttempt?.()
    const parts: Buffer[] = []
    let format = '', size = 0
    for (const part of chunks(text)) {
      const audio = await providerChunk(part, voice, controller.signal)
      if (format && audio.format !== format) throw failure('google-invalid-audio', 'Google returned incompatible MP3 chunks.')
      format = audio.format
      size += audio.bytes.length
      if (size > MAX_AUDIO) throw failure('google-audio-too-large', 'Narration exceeds the safe audio size limit.')
      parts.push(audio.bytes)
    }
    const audio = Buffer.concat(parts)
    if (hosted) {
      const result = await googleHostedOperation('finish', hash, token, 0, 0, audio)
      if (result.status !== 'saved') throw failure('google-storage-unavailable', 'Google narration could not be cached privately.')
    } else transaction(db => {
      let size = Number(db.prepare('SELECT COALESCE(SUM(length(audio)),0) AS size FROM google_tts_audio').get()!.size)
      for (const row of db.prepare('SELECT hash,length(audio) AS size FROM google_tts_audio WHERE audio IS NOT NULL ORDER BY expires').all()) {
        if (size + audio.length <= MAX_CACHE) break
        db.prepare('UPDATE google_tts_audio SET audio=NULL WHERE hash=?').run(row.hash!)
        size -= Number(row.size)
      }
      db.prepare("UPDATE google_tts_audio SET status='ready',audio=?,expires=? WHERE hash=?").run(audio, Date.now() + RETENTION, hash)
    })
    return audio
  } catch (error) {
    if (hosted) await googleHostedOperation('fail', hash, token)
    else transaction(db => { db.prepare("UPDATE google_tts_audio SET status='failed',audio=NULL WHERE hash=?").run(hash) })
    if (error instanceof SharedStoryError) throw error
    throw failure('google-provider-failure', 'Google narration failed or timed out. This paid request will not be retried.')
  } finally { clearTimeout(timer) }
}

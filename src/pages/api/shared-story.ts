import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import { createReadStream, promises as fs } from 'fs'
import { pipeline } from 'stream/promises'
import type { NextApiRequest, NextApiResponse } from 'next'
import { generateSharedStory, sharedStoryProviderConfig } from '../../lib/sharedStoryGenerator'
import { normalizeSharedAnswer, parseSharedStoryBrief, sharedStoryPlayerView, SharedStoryError } from '../../lib/sharedStory'
import { storyDatabase as database, reserveStoryRequest as reserveRequest } from '../../lib/storyRequestLimits'
import type { StoryRepository, StoredStory } from '../../lib/storyRepository'
import { requireAccount, type AccountUser } from '../../lib/accountAuth'
import { adventureGlobalCap, adventureChoiceView, generateAdventureTurn, parseAdventureAction, type AdventureRequest } from '../../lib/sharedAdventure'
import {
  mediaSignatureMatches, mediaSummary, parseMediaDeclaration, SHARED_MEDIA_ATTEMPTS_PER_STORY, SHARED_MEDIA_UPLOAD_WINDOW_MS,
  parseVoiceDeclaration, SHARED_VOICE_ATTEMPTS_PER_STORY, SHARED_VOICE_UPLOAD_WINDOW_MS, SHARED_VOICE_MAX_BYTES,
  parseWavDuration, voiceSummary, type SharedMediaRecord, type SharedVoiceRecord
} from '../../lib/sharedStoryMedia'
import { sharedMediaStore, type SharedMediaStore } from '../../lib/sharedMediaStore'
import { apiSafety, reportOperation } from '../../lib/operations'
import { requireProviderConsent } from '../../lib/providerConsent'
import { parseStoryRomance, requireRomanceConfirmation } from '../../lib/storyRomance'
import { generateStudioScene, purgeStudioAudio, readStudioAudio, studioStatus } from '../../lib/studioNarration'
import { PERMANENT_STORY_EXPIRY, publicStoryExpiry } from '../../lib/storyRetention'
import { matchesRecoveryKey, recoveryKey } from '../../lib/creatorRecovery'

export const config = { api: { bodyParser: { sizeLimit: '20kb' } }, maxDuration: 60 }

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const secret = () => randomBytes(32).toString('hex')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const PLAYER_ACTIONS = ['open', 'next', 'guess', 'hint', 'skip', 'adventure', 'media', 'voice', 'reply', 'studio-audio']
const OWNER_ACTIONS = ['library', 'manage', 'progress', 'share', 'title', 'delete', 'media-start', 'media-finish', 'media-cancel', 'media-delete', 'media-preview', 'voice-start', 'voice-finish', 'voice-cancel', 'voice-delete', 'voice-preview', 'studio-status', 'studio-generate']

async function storyProgress(db: StoryRepository, story: StoredStory) {
  return {
    ...await db.progress(story.id, Boolean(story.brief.adventure)),
    sceneCount: story.brief.adventure ? null : story.content.scenes.length
  }
}

function matches(secretValue: string, storedHash: string): boolean {
  const actual = Buffer.from(hash(secretValue), 'hex')
  const expected = Buffer.from(storedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function parseCapability(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}\.[0-9a-f]{64}$/.test(value)) {
    throw new SharedStoryError('This private story link is invalid.', 404)
  }
  const [id, key] = value.split('.')
  if (!UUID.test(id)) {
    throw new SharedStoryError('This private story link is invalid.', 404)
  }
  return { id, key }
}

// Removes stored objects whose media rows were deleted (replacement, failure,
// owner removal, story deletion or expiry). Failures stay queued for later.
async function purgeMedia(db: StoryRepository, store?: SharedMediaStore, strict = false) {
  if (!strict) await sweepStudioAudio(db, store)
  try {
    // Strict mode (before paid generation) only proves the media tables are reachable.
    const mediaKeys = await db.mediaPurgeQueue(strict ? 0 : 20)
    const voiceKeys = await db.voicePurgeQueue(strict ? 0 : 20)
    const keys = [...mediaKeys, ...voiceKeys]
    if (!keys.length) return
    await (store ?? sharedMediaStore()).remove(keys)
    await db.mediaPurged(mediaKeys)
    await db.voicePurged(voiceKeys)
  } catch (error) {
    if (strict) throw error
    console.error('Shared media cleanup deferred', error instanceof Error ? error.name : 'Unknown error')
    await reportOperation('storage-failure')
  }
}

async function sweepStudioAudio(db: StoryRepository, store?: SharedMediaStore) {
  try {
    await purgeStudioAudio(db, store)
  } catch (error) {
    // Keep legacy playback usable before the optional migration; never acknowledge
    // failed object removal, so migrated installations retain their purge queue.
    console.error('Studio audio cleanup deferred', error instanceof Error ? error.name : 'Unknown error')
    await reportOperation('storage-failure')
  }
}

async function deliverVoice(res: NextApiResponse, store: SharedMediaStore, record: SharedVoiceRecord) {
  const delivery = await store.deliver(record.object_key)
  if (delivery.type === 'url') {
    return res.status(200).json({ voice: { mime: record.mime, url: delivery.url, expiresAt: delivery.expiresAt } })
  }
  let size: number
  try { size = (await fs.stat(delivery.path)).size } catch { throw new SharedStoryError('The voice recording is no longer available.', 404) }
  if (size !== Number(record.size)) throw new SharedStoryError('The voice recording is no longer available.', 404)
  res.setHeader('Content-Type', record.mime)
  res.setHeader('Content-Length', String(size))
  res.setHeader('Content-Disposition', 'inline')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  res.status(200)
  await pipeline(createReadStream(delivery.path), res)
}

async function deliverMedia(res: NextApiResponse, store: SharedMediaStore, record: SharedMediaRecord) {
  const delivery = await store.deliver(record.object_key)
  if (delivery.type === 'url') {
    return res.status(200).json({ media: { kind: record.kind, mime: record.mime, url: delivery.url, expiresAt: delivery.expiresAt } })
  }
  let size: number
  try { size = (await fs.stat(delivery.path)).size } catch { throw new SharedStoryError('The photo or video is no longer available.', 404) }
  if (size !== Number(record.size)) throw new SharedStoryError('The photo or video is no longer available.', 404)
  res.setHeader('Content-Type', record.mime)
  res.setHeader('Content-Length', String(size))
  res.setHeader('Content-Disposition', 'inline')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  res.status(200)
  await pipeline(createReadStream(delivery.path), res)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!await apiSafety(req, res, true)) return
  const origin = req.headers.origin
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) {
        return res.status(403).json({ error: 'Cross-origin story requests are not allowed.' })
      }
    } catch {
      return res.status(403).json({ error: 'Invalid request origin.' })
    }
  }
  try {
    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SharedStoryError('Story request is required.')
    const action: unknown = body.action
    if (!['create', ...OWNER_ACTIONS, ...PLAYER_ACTIONS].includes(String(action))) {
      throw new SharedStoryError('Unsupported story action.')
    }
    const studioPreview = action === 'studio-audio' && body.preview === true
    const ownerActionRequested = !PLAYER_ACTIONS.includes(String(action)) || studioPreview
    const account: AccountUser | null = ownerActionRequested ? await requireAccount(req, res) : null
    if (ownerActionRequested && !account) return
    if (action === 'library') {
      if (body.after !== undefined && body.after !== null && (typeof body.after !== 'string' || !UUID.test(body.after))) {
        throw new SharedStoryError('The story collection page is invalid.')
      }
      const db = database()
      const page = await db.listRetained(account!.id, body.after || null, 21)
      const stories = await Promise.all(page.slice(0, 20).map(async story => ({
        recovered: true,
        ownerToken: `${story.id}.${recoveryKey(story, 'owner', account!.id)}`,
        playToken: `${story.id}.${recoveryKey(story, 'play', account!.id)}`,
        brief: story.brief, content: story.content, expiresAt: publicStoryExpiry(story.expires_at),
        ...(body.includeProgress === true ? { progress: await storyProgress(db, story) } : {})
      })))
      return res.status(200).json({ stories, next: page.length > 20 ? page[19].id : null })
    }
    if (action === 'create' || action === 'adventure' || action === 'studio-generate') requireProviderConsent(body)
    if (action === 'create') {
      // Media is declared outside the brief so its metadata can never reach the AI prompt.
      const finalMedia = body.finalMedia === undefined ? null : parseMediaDeclaration(body.finalMedia)
      const finalVoice = body.finalVoice === undefined ? null : parseVoiceDeclaration(body.finalVoice)
      const brief = parseSharedStoryBrief(body.brief, { allowEmptyMessage: Boolean(finalMedia) })
      try { requireRomanceConfirmation(brief.romance, body.romanceConfirmed) } catch (error) {
        throw new SharedStoryError(error instanceof Error ? error.message : 'Confirm the romance boundaries before creating this story.')
      }
      if (finalVoice && !brief.gift) throw new SharedStoryError('Voice reveals are available only for gift stories.', 409)
      const db = database()
      if (brief.gift) {
        await db.giftReady()
        await sharedMediaStore().ready('audio/wav')
      }
      sharedStoryProviderConfig()
      // A file that cannot be stored must fail before the paid generation call.
      if (finalMedia) {
        await sharedMediaStore().ready()
        await purgeMedia(db, undefined, true)
      }
      if (brief.adventure) await db.adventure({ operation: 'ready', storyId: '', sessionHash: '', playHash: '', cap: adventureGlobalCap() })
      await reserveRequest(db, req, 'generate')
      // Reservations also delete expired stories; remove their queued media objects.
      await purgeMedia(db)
      const content = await generateSharedStory(brief)
      const id = randomUUID()
      const ownerKey = secret()
      const playKey = secret()
      const expiresAt = PERMANENT_STORY_EXPIRY
      await db.insert({
        id, owner_hash: hash(ownerKey), play_hash: hash(playKey),
        owner_id: account!.id,
        brief, content, answer_normalized: normalizeSharedAnswer(brief.solution),
        alternative_answers_normalized: (brief.alternativeAnswers ?? []).map(normalizeSharedAnswer), expires_at: expiresAt
      })
      await reportOperation('story-created')
      return res.status(201).json({
        ownerToken: `${id}.${ownerKey}`, playToken: `${id}.${playKey}`, brief, content, expiresAt: null,
        media: null, voice: null, mediaRequired: !brief.message
      })
    }
    const { id, key } = parseCapability(body.token)
    const db = database()
    await sweepStudioAudio(db)
    const story = await db.findUnexpired(id)
    const ownerAction = OWNER_ACTIONS.includes(String(action)) || studioPreview
    const recoveredKey = story && (ownerAction
      ? account && matchesRecoveryKey(key, story, 'owner', account.id)
      : story.owner_id && matchesRecoveryKey(key, story, 'play', story.owner_id))
    if (!story || (!matches(key, ownerAction ? story.owner_hash : story.play_hash) && !recoveredKey)) {
      throw new SharedStoryError('This story link is invalid, expired, or has been deleted.', 404)
    }
    if (ownerAction && account && story.owner_id !== account.id) {
      if (story.owner_id || !await db.claimStoryOwner(id, account.id)) {
        throw new SharedStoryError('This story belongs to a different account.', 404)
      }
    }
    let romance: ReturnType<typeof parseStoryRomance>
    try { romance = parseStoryRomance(story.brief.romance) } catch {
      throw new SharedStoryError('This story has invalid romance settings. Ask its creator for a new story.', 409)
    }
    if (!ownerAction && romance && body.romanceConfirmed !== true) {
      if (action === 'open') {
        return res.status(200).json({ romanceNotice: { romance, ...(story.brief.language ? { language: story.brief.language } : {}) } })
      }
      throw new SharedStoryError('Confirm you are 18 or older and choose to open this romance story before continuing.', 403)
    }
    if (action === 'delete') {
      await db.delete(id)
      await purgeMedia(db)
      return res.status(200).json({ deleted: true })
    }
    if (action === 'studio-status' || action === 'studio-generate') {
      await purgeStudioAudio(db)
      const studio = action === 'studio-status' ? await studioStatus(db, story) :
        await generateStudioScene(db, story, body.sceneIndex)
      return res.status(200).json({ studio })
    }
    if (studioPreview) {
      const audio = await readStudioAudio(db, story, body.sceneIndex)
      res.setHeader('Content-Type', 'audio/mpeg')
      res.setHeader('Content-Length', String(audio.length))
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Disposition', 'inline')
      return res.status(200).send(Buffer.from(audio))
    }
    if (action === 'progress') {
      return res.status(200).json({ progress: await storyProgress(db, story) })
    }
    if (action === 'manage') {
      if (story.brief.gift) await db.giftReady()
      const voice = story.brief.gift ? await db.voiceReady(id) : null
      return res.status(200).json({
        brief: story.brief, content: story.content, expiresAt: publicStoryExpiry(story.expires_at),
        media: mediaSummary(await db.mediaReady(id)), voice: voiceSummary(voice),
        replies: story.brief.gift ? await db.giftReplies(id) : [],
        mediaRequired: !story.brief.message
      })
    }
    if (action === 'title') {
      if (typeof body.title !== 'string') throw new SharedStoryError('Enter a story title.')
      const title = body.title.trim()
      if (!title || title.length > 120) throw new SharedStoryError('The title must be between 1 and 120 characters.')
      const normalizedTitle = normalizeSharedAnswer(title)
      if (!normalizedTitle) throw new SharedStoryError('The title must include letters or numbers.')
      const privateValues = [story.brief.solution, story.brief.message, ...(story.brief.alternativeAnswers ?? []), ...(story.brief.assistanceHints ?? [])]
      if (privateValues.some(value => {
        const normalized = normalizeSharedAnswer(value)
        return normalized.length > 0 && normalizedTitle.includes(normalized)
      })) {
        throw new SharedStoryError('The title cannot reveal a private answer, hint, or final message.')
      }
      const content = { ...story.content, title }
      await db.updateContent(id, content)
      return res.status(200).json({ content })
    }
    if (action === 'share') {
      const playKey = secret()
      await db.rotate(id, hash(playKey))
      return res.status(200).json({ playToken: `${id}.${playKey}` })
    }
    if (action === 'media-start') {
      const declaration = parseMediaDeclaration(body.media)
      const store = sharedMediaStore()
      await purgeMedia(db, store)
      await reserveRequest(db, req, 'upload')
      const uploadId = randomUUID()
      const uploadSecret = secret()
      const record: SharedMediaRecord = {
        id: uploadId, story_id: id, object_key: `stories/${id}/${uploadId}.${declaration.ext}`,
        kind: declaration.kind, mime: declaration.mime, size: declaration.size, status: 'pending',
        upload_hash: hash(uploadSecret), upload_expires_at: new Date(Date.now() + SHARED_MEDIA_UPLOAD_WINDOW_MS).toISOString(),
        created_at: new Date().toISOString()
      }
      if (!await db.mediaBegin(record, SHARED_MEDIA_ATTEMPTS_PER_STORY)) {
        throw new SharedStoryError(`This story reached its limit of ${SHARED_MEDIA_ATTEMPTS_PER_STORY} upload attempts. The story is unchanged; create a new story to attach a different file.`, 429)
      }
      try {
        const upload = await store.createUpload(record, uploadSecret)
        return res.status(201).json({ uploadId, upload, uploadExpiresAt: record.upload_expires_at })
      } catch (error) {
        await reportOperation('request-failure')
        await db.mediaDiscard(id, uploadId).catch(() => undefined)
        throw error
      }
    }
    if (action === 'media-finish' || action === 'media-cancel') {
      if (typeof body.uploadId !== 'string' || !UUID.test(body.uploadId)) throw new SharedStoryError('Upload reference is invalid.')
      const record = await db.mediaGet(body.uploadId)
      if (!record || record.story_id !== id || record.status !== 'pending') {
        throw new SharedStoryError('This upload is no longer available. Choose the file again; your story is unchanged.', 404)
      }
      const store = sharedMediaStore()
      const discard = async () => {
        await db.mediaDiscard(id, record.id)
        await purgeMedia(db, store)
      }
      if (action === 'media-cancel') {
        await discard()
        return res.status(200).json({ cancelled: true })
      }
      if (Date.parse(record.upload_expires_at) <= Date.now()) {
        await discard()
        throw new SharedStoryError('The upload window expired. Choose the file again; your story is unchanged.', 410)
      }
      const stat = await store.stat(record.object_key)
      if (!stat) throw new SharedStoryError('The file has not arrived yet. Retry the upload; your story is unchanged.', 409)
      if (stat.size !== Number(record.size) || (stat.contentType && stat.contentType.split(';')[0].trim().toLowerCase() !== record.mime) ||
          !mediaSignatureMatches(stat.head, record.mime)) {
        await discard()
        throw new SharedStoryError('The uploaded file does not match its declared type and size, so it was removed. Choose a valid JPEG, PNG, WebP, MP4 or WebM file; your story is unchanged.', 415)
      }
      await db.mediaActivate(id, record.id)
      await purgeMedia(db, store)
      return res.status(200).json({ media: mediaSummary(record), mediaRequired: !story.brief.message })
    }
    if (action === 'media-delete') {
      await db.mediaDiscard(id)
      await purgeMedia(db)
      return res.status(200).json({ media: null, mediaRequired: !story.brief.message })
    }
    if (action === 'media-preview') {
      const ready = await db.mediaReady(id)
      if (!ready) throw new SharedStoryError('No photo or video is attached to this story.', 404)
      return await deliverMedia(res, sharedMediaStore(), ready)
    }
    if (action === 'voice-start') {
      if (!story.brief.gift) throw new SharedStoryError('Voice reveals are available only for gift stories.', 409)
      await db.giftReady()
      const declaration = parseVoiceDeclaration(body.voice)
      const store = sharedMediaStore()
      await store.ready('audio/wav')
      await purgeMedia(db, store)
      await reserveRequest(db, req, 'upload')
      const uploadId = randomUUID()
      const uploadSecret = secret()
      const record: SharedVoiceRecord = {
        id: uploadId, story_id: id, object_key: `stories/${id}/${uploadId}.wav`, kind: 'voice',
        mime: declaration.mime, size: declaration.size, status: 'pending',
        upload_hash: hash(uploadSecret),
        upload_expires_at: new Date(Date.now() + SHARED_VOICE_UPLOAD_WINDOW_MS).toISOString(),
        created_at: new Date().toISOString()
      }
      if (!await db.voiceBegin(record, SHARED_VOICE_ATTEMPTS_PER_STORY)) {
        throw new SharedStoryError(`This story reached its limit of ${SHARED_VOICE_ATTEMPTS_PER_STORY} voice upload attempts. The story is unchanged.`, 429)
      }
      try {
        const upload = await store.createUpload(record, uploadSecret)
        return res.status(201).json({ uploadId, upload, uploadExpiresAt: record.upload_expires_at })
      } catch (error) {
        await reportOperation('request-failure')
        await db.voiceDiscard(id, uploadId).catch(() => undefined)
        throw error
      }
    }
    if (action === 'voice-finish' || action === 'voice-cancel') {
      if (!story.brief.gift) throw new SharedStoryError('Voice reveals are available only for gift stories.', 409)
      await db.giftReady()
      if (typeof body.uploadId !== 'string' || !UUID.test(body.uploadId)) throw new SharedStoryError('Upload reference is invalid.')
      const record = await db.voiceGet(body.uploadId)
      if (!record || record.story_id !== id || record.status !== 'pending') {
        throw new SharedStoryError('This voice upload is no longer available. Choose the recording again.', 404)
      }
      const store = sharedMediaStore()
      const discard = async () => {
        await db.voiceDiscard(id, record.id)
        await purgeMedia(db, store)
      }
      if (action === 'voice-cancel') {
        await discard()
        return res.status(200).json({ cancelled: true })
      }
      if (Date.parse(record.upload_expires_at) <= Date.now()) {
        await discard()
        throw new SharedStoryError('The upload window expired. Choose the recording again.', 410)
      }
      const stat = await store.stat(record.object_key)
      const bytes = stat?.size === Number(record.size) ? await store.read(record.object_key, SHARED_VOICE_MAX_BYTES) : null
      try {
        if (!stat || stat.size !== Number(record.size) ||
            (stat.contentType && stat.contentType.split(';')[0].trim().toLowerCase() !== record.mime) ||
            !bytes || bytes.length !== Number(record.size)) {
          throw new SharedStoryError('The uploaded recording does not match its declared type and size.', 415)
        }
        parseWavDuration(bytes)
      } catch (error) {
        await discard()
        throw error
      }
      await db.voiceActivate(id, record.id)
      await purgeMedia(db, store)
      return res.status(200).json({ voice: voiceSummary(record) })
    }
    if (action === 'voice-delete') {
      if (!story.brief.gift) throw new SharedStoryError('Voice reveals are available only for gift stories.', 409)
      await db.giftReady()
      await db.voiceDiscard(id)
      await purgeMedia(db)
      return res.status(200).json({ voice: null })
    }
    if (action === 'voice-preview') {
      if (!story.brief.gift) throw new SharedStoryError('Voice reveals are available only for gift stories.', 409)
      await db.giftReady()
      const readyVoice = await db.voiceReady(id)
      if (!readyVoice) throw new SharedStoryError('No voice recording is attached to this story.', 404)
      return await deliverVoice(res, sharedMediaStore(), readyVoice)
    }
    let sessionToken: string
    if (body.sessionToken === undefined && action === 'open') {
      sessionToken = secret()
    } else if (typeof body.sessionToken === 'string' && /^[0-9a-f]{64}$/.test(body.sessionToken)) {
      sessionToken = body.sessionToken
    } else {
      throw new SharedStoryError('Player session is invalid. Reopen the story link.')
    }
    const ready = await db.mediaReady(id)
    const readyVoice = story.brief.gift ? await db.voiceReady(id) : null
    if (action === 'studio-audio') {
      if (!story.brief.message && !ready) throw new SharedStoryError('The creator is still finishing this story.', 409)
      const audio = await readStudioAudio(db, story, body.sceneIndex, hash(sessionToken))
      res.setHeader('Content-Type', 'audio/mpeg')
      res.setHeader('Content-Length', String(audio.length))
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Disposition', 'inline')
      return res.status(200).send(Buffer.from(audio))
    }
    if (action === 'media') {
      if (!story.brief.message && !ready) {
        throw new SharedStoryError('The creator is still finishing this story. Try the link again a little later.', 409)
      }
      const state = await db.advance(id, hash(sessionToken), 'open', '', story.play_hash)
      if (!state.solved && !state.skipped) throw new SharedStoryError('Unlock the story before opening its final reveal.', 403)
      if (!ready) throw new SharedStoryError('This story has no photo or video.', 404)
      return await deliverMedia(res, sharedMediaStore(), ready)
    }
    if (action === 'voice') {
      if (!story.brief.message && !ready) {
        throw new SharedStoryError('The creator is still finishing this story. Try the link again a little later.', 409)
      }
      if (!story.brief.gift) throw new SharedStoryError('This story has no voice reveal.', 404)
      const state = await db.advance(id, hash(sessionToken), 'open', '', story.play_hash)
      if (!state.solved && !state.skipped) throw new SharedStoryError('Unlock the story before opening its voice reveal.', 403)
      if (!readyVoice) throw new SharedStoryError('This story has no voice recording.', 404)
      return await deliverVoice(res, sharedMediaStore(), readyVoice)
    }
    if (action === 'reply') {
      if (!story.brief.gift?.allowReply) throw new SharedStoryError('The creator has not enabled replies for this story.', 403)
      if (typeof body.reply !== 'string' || body.reply.length > 1000 || !body.reply.trim()) {
        throw new SharedStoryError('Your reply must be text of up to 1000 characters.')
      }
      await db.giftReply(id, hash(sessionToken), body.reply.trim())
      return res.status(200).json({ sent: true })
    }
    if (!story.brief.message && !ready) {
      throw new SharedStoryError('The creator is still finishing this story. Try the link again a little later.', 409)
    }
    if (action === 'skip') {
      if (body.confirmSkip !== true) throw new SharedStoryError('Confirm that you want to reveal the surprise without solving.')
      if (story.brief.unlockPolicy !== 'allow-skip') throw new SharedStoryError('The sender chose Solve to unlock for this story.', 403)
    }
    let guess = ''
    if (action === 'guess') {
      if (typeof body.guess !== 'string' || body.guess.length > 200) throw new SharedStoryError('Your guess must be text of up to 200 characters.')
      guess = normalizeSharedAnswer(body.guess)
      if (!guess) throw new SharedStoryError('Enter an answer before submitting.')
      await reserveRequest(db, req, 'guess')
    }
    if (story.brief.adventure && action === 'next') throw new SharedStoryError('Use a freeform adventure action instead of Next.')
    const state = await db.advance(id, hash(sessionToken), action === 'adventure' ? 'open' : action as 'open' | 'next' | 'guess' | 'hint' | 'skip', guess, story.play_hash)
    if (action === 'adventure' && (state.solved || state.skipped)) throw new SharedStoryError('The surprise is already revealed. Reopen to refresh your story.', 409)
    const feedback = state.skipped ? 'Revealed without solving' : action === 'guess' ? state.solved ? 'You solved it.' : 'Not quite. Explore the clues and try again.' : undefined
    const player = sharedStoryPlayerView(story.brief, story.content, state, feedback, ready, readyVoice)
    if (action === 'adventure' && !story.brief.adventure) throw new SharedStoryError('This story does not enable live adventure actions.')
    if (story.brief.adventure) {
      const base: AdventureRequest = { storyId: id, sessionHash: hash(sessionToken), playHash: story.play_hash, operation: 'view', cap: adventureGlobalCap() }
      player.scene = { ...player.scene, choices: undefined }
      if (action === 'adventure') {
        const currentView = (await db.adventure(base)).view
        const authoritativeChoices = currentView.turn ? currentView.turn.choices : story.content.scenes[0]?.choices
        const submission = parseAdventureAction(body, story.brief, authoritativeChoices, body.revision !== currentView.revision)
        sharedStoryProviderConfig()
        const reservation = { ...base, ...submission, operation: 'reserve' as const }
        const reserved = await db.adventure(reservation)
        player.adventure = adventureChoiceView(reserved.view, story)
        if (reserved.status === 'pending' || reserved.status === 'failed') {
          return res.status(409).json({ error: reserved.status === 'pending' ? 'This action is still processing. Reopen to refresh; do not submit it again with a new ID.' : 'This action attempt failed and was charged. Review progress before submitting a new action.', player, sessionToken })
        }
        if (reserved.status === 'reserved') {
          try {
            const turn = await generateAdventureTurn(story, reserved.view, submission.text)
            player.adventure = adventureChoiceView((await db.adventure({ ...reservation, operation: 'finish', turn })).view, story)
          } catch (error) {
            if (!(error instanceof SharedStoryError) || error.status >= 500) await reportOperation('request-failure')
            try { player.adventure = adventureChoiceView((await db.adventure({ ...reservation, operation: 'finish', failed: true })).view, story) } catch { /* Reservation stays charged, and expires without retry. */ }
            return res.status(error instanceof SharedStoryError ? error.status : 502).json({
              error: `${error instanceof SharedStoryError ? error.message : 'The adventure action failed.'} The reserved attempt remains charged. Reopen to refresh before a new action.`, player, sessionToken
            })
          }
        }
      } else {
        player.adventure = adventureChoiceView((await db.adventure(base)).view, story)
      }
    }
    return res.status(200).json({ player, sessionToken })
  } catch (error) {
    if (res.headersSent) {
      console.error('Shared Story media stream interrupted', error instanceof Error ? error.name : 'Unknown error')
      return void res.destroy()
    }
    if (error instanceof SharedStoryError) return res.status(error.status).json({ error: error.message })
    console.error('Shared Story request failed', error instanceof Error ? error.name : 'Unknown error')
    return res.status(500).json({ error: 'The story request failed. Please try again later.' })
  }
}

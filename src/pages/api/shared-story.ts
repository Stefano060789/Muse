import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import { createReadStream, promises as fs } from 'fs'
import { pipeline } from 'stream/promises'
import type { NextApiRequest, NextApiResponse } from 'next'
import { generateSharedStory, sharedStoryProviderConfig } from '../../lib/sharedStoryGenerator'
import { normalizeSharedAnswer, parseSharedStoryBrief, sharedStoryPlayerView, SharedStoryError } from '../../lib/sharedStory'
import { storyDatabase as database, reserveStoryRequest as reserveRequest } from '../../lib/storyRequestLimits'
import type { StoryRepository } from '../../lib/storyRepository'
import { requireCreatorAccess } from '../../lib/creatorAccess'
import { adventureGlobalCap, adventureChoiceView, generateAdventureTurn, parseAdventureAction, type AdventureRequest } from '../../lib/sharedAdventure'
import {
  mediaSignatureMatches, mediaSummary, parseMediaDeclaration, SHARED_MEDIA_ATTEMPTS_PER_STORY, SHARED_MEDIA_UPLOAD_WINDOW_MS,
  type SharedMediaRecord
} from '../../lib/sharedStoryMedia'
import { sharedMediaStore, type SharedMediaStore } from '../../lib/sharedMediaStore'
import { apiSafety, reportOperation } from '../../lib/operations'
import { requireProviderConsent } from '../../lib/providerConsent'

export const config = { api: { bodyParser: { sizeLimit: '20kb' } }, maxDuration: 60 }

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const secret = () => randomBytes(32).toString('hex')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const PLAYER_ACTIONS = ['open', 'next', 'guess', 'hint', 'skip', 'adventure', 'media']
const OWNER_ACTIONS = ['manage', 'share', 'delete', 'media-start', 'media-finish', 'media-cancel', 'media-delete', 'media-preview']

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
  try {
    // Strict mode (before paid generation) only proves the media tables are reachable.
    const keys = await db.mediaPurgeQueue(strict ? 0 : 20)
    if (!keys.length) return
    await (store ?? sharedMediaStore()).remove(keys)
    await db.mediaPurged(keys)
  } catch (error) {
    if (strict) throw error
    console.error('Shared media cleanup deferred', error instanceof Error ? error.name : 'Unknown error')
    await reportOperation('storage-failure')
  }
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
    if (!PLAYER_ACTIONS.includes(String(action)) && !requireCreatorAccess(req, res)) return
    if (action === 'create' || action === 'adventure') requireProviderConsent(body)
    if (action === 'create') {
      // Media is declared outside the brief so its metadata can never reach the AI prompt.
      const finalMedia = body.finalMedia === undefined ? null : parseMediaDeclaration(body.finalMedia)
      const brief = parseSharedStoryBrief(body.brief, { allowEmptyMessage: Boolean(finalMedia) })
      sharedStoryProviderConfig()
      const db = database()
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
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      await db.insert({
        id, owner_hash: hash(ownerKey), play_hash: hash(playKey),
        brief, content, answer_normalized: normalizeSharedAnswer(brief.solution),
        alternative_answers_normalized: (brief.alternativeAnswers ?? []).map(normalizeSharedAnswer), expires_at: expiresAt
      })
      return res.status(201).json({
        ownerToken: `${id}.${ownerKey}`, playToken: `${id}.${playKey}`, brief, content, expiresAt,
        media: null, mediaRequired: !brief.message
      })
    }
    const { id, key } = parseCapability(body.token)
    const db = database()
    const story = await db.findUnexpired(id)
    const ownerAction = OWNER_ACTIONS.includes(String(action))
    if (!story || !matches(key, ownerAction ? story.owner_hash : story.play_hash)) {
      throw new SharedStoryError('This story link is invalid, expired, or has been deleted.', 404)
    }
    if (action === 'delete') {
      await db.delete(id)
      await purgeMedia(db)
      return res.status(200).json({ deleted: true })
    }
    if (action === 'manage') {
      return res.status(200).json({
        brief: story.brief, content: story.content, expiresAt: story.expires_at,
        media: mediaSummary(await db.mediaReady(id)), mediaRequired: !story.brief.message
      })
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
    let sessionToken: string
    if (body.sessionToken === undefined && action === 'open') {
      sessionToken = secret()
    } else if (typeof body.sessionToken === 'string' && /^[0-9a-f]{64}$/.test(body.sessionToken)) {
      sessionToken = body.sessionToken
    } else {
      throw new SharedStoryError('Player session is invalid. Reopen the story link.')
    }
    const ready = await db.mediaReady(id)
    if (!story.brief.message && !ready) {
      throw new SharedStoryError('The creator is still finishing this story. Try the link again a little later.', 409)
    }
    if (action === 'media') {
      const state = await db.advance(id, hash(sessionToken), 'open', '', story.play_hash)
      if (!state.solved && !state.skipped) throw new SharedStoryError('Unlock the story before opening its final reveal.', 403)
      if (!ready) throw new SharedStoryError('This story has no photo or video.', 404)
      return await deliverMedia(res, sharedMediaStore(), ready)
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
    const player = sharedStoryPlayerView(story.brief, story.content, state, feedback, ready)
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

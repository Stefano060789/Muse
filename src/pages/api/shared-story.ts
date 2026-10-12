import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { generateSharedStory, sharedStoryProviderConfig } from '../../lib/sharedStoryGenerator'
import { normalizeSharedAnswer, parseSharedStoryBrief, sharedStoryPlayerView, SharedStoryError } from '../../lib/sharedStory'
import { storyDatabase as database, reserveStoryRequest as reserveRequest } from '../../lib/storyRequestLimits'

export const config = { api: { bodyParser: { sizeLimit: '20kb' } }, maxDuration: 60 }

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const secret = () => randomBytes(32).toString('hex')

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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    throw new SharedStoryError('This private story link is invalid.', 404)
  }
  return { id, key }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
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
    if (!['create', 'manage', 'share', 'delete', 'open', 'next', 'guess', 'hint'].includes(String(action))) {
      throw new SharedStoryError('Unsupported story action.')
    }
    if (action === 'create') {
      const brief = parseSharedStoryBrief(body.brief)
      sharedStoryProviderConfig()
      const db = database()
      await reserveRequest(db, req, 'generate')
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
        ownerToken: `${id}.${ownerKey}`, playToken: `${id}.${playKey}`, brief, content, expiresAt
      })
    }
    const { id, key } = parseCapability(body.token)
    const db = database()
    const story = await db.findUnexpired(id)
    const ownerAction = action === 'manage' || action === 'share' || action === 'delete'
    if (!story || !matches(key, ownerAction ? story.owner_hash : story.play_hash)) {
      throw new SharedStoryError('This story link is invalid, expired, or has been deleted.', 404)
    }
    if (action === 'delete') {
      await db.delete(id)
      return res.status(200).json({ deleted: true })
    }
    if (action === 'manage') {
      return res.status(200).json({ brief: story.brief, content: story.content, expiresAt: story.expires_at })
    }
    if (action === 'share') {
      const playKey = secret()
      await db.rotate(id, hash(playKey))
      return res.status(200).json({ playToken: `${id}.${playKey}` })
    }
    let sessionToken: string
    if (body.sessionToken === undefined && action === 'open') {
      sessionToken = secret()
    } else if (typeof body.sessionToken === 'string' && /^[0-9a-f]{64}$/.test(body.sessionToken)) {
      sessionToken = body.sessionToken
    } else {
      throw new SharedStoryError('Player session is invalid. Reopen the story link.')
    }
    let guess = ''
    if (action === 'guess') {
      if (typeof body.guess !== 'string' || body.guess.length > 200) throw new SharedStoryError('Your guess must be text of up to 200 characters.')
      guess = normalizeSharedAnswer(body.guess)
      if (!guess) throw new SharedStoryError('Enter an answer before submitting.')
      await reserveRequest(db, req, 'guess')
    }
    const state = await db.advance(id, hash(sessionToken), action as 'open' | 'next' | 'guess' | 'hint', guess, story.play_hash)
    const feedback = action === 'guess' ? state.solved ? 'You solved it.' : 'Not quite. Explore the clues and try again.' : undefined
    return res.status(200).json({ player: sharedStoryPlayerView(story.brief, story.content, state, feedback), sessionToken })
  } catch (error) {
    if (error instanceof SharedStoryError) return res.status(error.status).json({ error: error.message })
    console.error('Shared Story request failed', error instanceof Error ? error.name : 'Unknown error')
    return res.status(500).json({ error: 'The story request failed. Please try again later.' })
  }
}

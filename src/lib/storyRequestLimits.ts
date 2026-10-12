import { createHash, createHmac } from 'crypto'
import type { NextApiRequest } from 'next'
import { SharedStoryError } from './sharedStory'
import { storyRepository, storyStorageMode, type StoryRepository } from './storyRepository'

export const storyDatabase = storyRepository
export { storyStorageError } from './storyRepository'

export async function reserveStoryRequest(db: StoryRepository, req: NextApiRequest, kind: 'generate' | 'guess') {
  const address = process.env.VERCEL
    ? String(req.headers['x-vercel-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim()
    : req.socket.remoteAddress || 'local'
  const clientHash = storyStorageMode() === 'sqlite'
    ? createHash('sha256').update(`muse-local:${address}`).digest('hex')
    : createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(address).digest('hex')
  if (!await db.reserve(clientHash, kind)) {
    throw new SharedStoryError(kind === 'generate'
      ? 'Story generation limit reached. Please try again later (up to 5 requests per hour per connection).'
      : 'Too many guesses. Please try again later.', 429)
  }
}

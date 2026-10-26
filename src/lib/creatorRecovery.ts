import { createHmac, timingSafeEqual } from 'crypto'
import type { StoredStory } from './storyRepository'
import { SharedStoryError } from './sharedStory'

// Account recovery capabilities are scoped to one story, role and owner.
export function recoveryKey(story: StoredStory, role: 'owner' | 'play', accountId: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (process.env.NODE_ENV !== 'production' && process.env.STORY_STORAGE === 'sqlite' ? 'muse-local-development-account-recovery' : '')
  if (!secret || !story.owner_id || story.owner_id !== accountId) {
    throw new SharedStoryError('Account story recovery is not configured.', 503)
  }
  return createHmac('sha256', secret)
    .update(JSON.stringify(['muse-account-recovery-v1', accountId, story.id, role, role === 'owner' ? story.owner_hash : story.play_hash]))
    .digest('hex')
}

export function matchesRecoveryKey(value: string, story: StoredStory, role: 'owner' | 'play', accountId: string): boolean {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (process.env.NODE_ENV !== 'production' && process.env.STORY_STORAGE === 'sqlite' ? 'muse-local-development-account-recovery' : '')
  if (!secret || !/^[0-9a-f]{64}$/.test(value) || story.owner_id !== accountId) return false
  return timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(recoveryKey(story, role, accountId), 'hex'))
}

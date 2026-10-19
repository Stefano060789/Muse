import { createHmac, timingSafeEqual } from 'crypto'
import type { StoredStory } from './storyRepository'
import { SharedStoryError } from './sharedStory'

// Recovery capabilities are scoped to a story, role, current link hash and
// deployment administrator code; recovering never rotates existing links.
export function recoveryKey(story: StoredStory, role: 'owner' | 'play'): string {
  const code = process.env.MUSE_CREATOR_ACCESS_CODE
  if (!code || code.length < 16 || code.length > 512) {
    throw new SharedStoryError('Server recovery requires a configured private Creator access code.', 503)
  }
  return createHmac('sha256', code)
    .update(JSON.stringify(['muse-recovery-v1', story.id, role, role === 'owner' ? story.owner_hash : story.play_hash]))
    .digest('hex')
}

export function matchesRecoveryKey(value: string, story: StoredStory, role: 'owner' | 'play'): boolean {
  const code = process.env.MUSE_CREATOR_ACCESS_CODE
  if (!code || code.length < 16 || code.length > 512 || !/^[0-9a-f]{64}$/.test(value)) return false
  return timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(recoveryKey(story, role), 'hex'))
}

export const PERMANENT_STORY_EXPIRY = 'infinity'

export function storyHasAccess(expiresAt: string | null, now = Date.now()): boolean {
  return expiresAt === null || (Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > now)
}

export function publicStoryExpiry(expiresAt: string): string | null {
  if (expiresAt === PERMANENT_STORY_EXPIRY) return null
  if (!Number.isFinite(Date.parse(expiresAt))) throw new Error('The story expiry is invalid.')
  return expiresAt
}

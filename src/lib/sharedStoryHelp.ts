import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { SharedStoryError } from './sharedStory'

export const HELP_AFTER_FAILED_ATTEMPTS = 3

// Names one recipient playthrough without exposing its session token.
export function helpRequestId(storyId: string, sessionHash: string): string {
  return createHash('sha256').update(`help-request:${storyId}:${sessionHash}`).digest('hex').slice(0, 8).toUpperCase()
}

export function normalizeHelpRequestId(value: unknown): string {
  const id = typeof value === 'string' ? value.replace(/[\s-]/g, '').toUpperCase() : ''
  if (!/^[0-9A-F]{8}$/.test(id)) throw new SharedStoryError('Enter the 8-character request ID shown to the recipient.')
  return id
}

// Keyed by the stored owner hash, which a recipient link cannot reveal.
export function helpCode(ownerHash: string, storyId: string, requestId: string): string {
  const digest = createHmac('sha256', ownerHash).update(`help-code:${storyId}:${requestId}`).digest('hex').slice(0, 10).toUpperCase()
  return `${digest.slice(0, 5)}-${digest.slice(5)}`
}

export function matchesHelpCode(ownerHash: string, storyId: string, requestId: string, supplied: unknown): boolean {
  if (typeof supplied !== 'string' || supplied.length > 40) return false
  const actual = Buffer.from(supplied.replace(/[\s-]/g, '').toUpperCase())
  const expected = Buffer.from(helpCode(ownerHash, storyId, requestId).replace('-', ''))
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

import { createHash } from 'crypto'
import { reserveAiAttempt } from './operations'
import { consumeOperation } from './operationsStore'
import { SharedStoryError } from './sharedStory'

function parseCap(name: string, fallback: number): number {
  const raw = process.env[name] || String(fallback)
  if (!/^\d+$/.test(raw)) throw new SharedStoryError(`${name} must be an integer from 1 to 200.`, 503)
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new SharedStoryError(`${name} must be an integer from 1 to 200.`, 503)
  }
  return value
}

export function storyReelUserDailyCaps() {
  return {
    plan: parseCap('MUSE_STORY_REEL_PLAN_USER_DAILY_CAP', 10),
    image: parseCap('MUSE_STORY_REEL_IMAGE_USER_DAILY_CAP', 24)
  }
}

function dayBucket(kind: 'plan' | 'image', accountId: string): string {
  const account = createHash('sha256').update(accountId).digest('hex').slice(0, 24)
  const day = new Date(Date.now()).toISOString().slice(0, 10)
  return `storyreel-${kind}:${day}:${account}`
}

async function reserve(kind: 'plan' | 'image', accountId: string, cap: number, message: string) {
  const tomorrow = new Date(Date.now())
  tomorrow.setUTCHours(24, 0, 0, 0)
  const reservation = await consumeOperation(dayBucket(kind, accountId), cap, tomorrow.toISOString())
  if (!reservation.allowed) throw new SharedStoryError(message, 429)
}

export async function reserveStoryReelPlanAttempt(accountId: string) {
  await reserve('plan', accountId, storyReelUserDailyCaps().plan,
    'Story-reel planning limit reached for today. Try again tomorrow (UTC).')
}

export async function reserveStoryReelImageAttempt(accountId: string) {
  await reserve('image', accountId, storyReelUserDailyCaps().image,
    'Story-reel image limit reached for today. Use local artwork fallback or try again tomorrow (UTC).')
  await reserveAiAttempt()
}

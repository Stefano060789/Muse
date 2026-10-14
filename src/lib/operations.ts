import { createHash, createHmac } from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { SharedStoryError } from './sharedStory'
import { consumeOperation, storeOperationAlert, operationStatus } from './operationsStore'

export const OPERATION_EVENTS = ['ai-budget-warning', 'ai-budget-exhausted', 'provider-failure', 'storage-failure', 'request-failure', 'client-render-failure'] as const
export type OperationEvent = typeof OPERATION_EVENTS[number]

export function dailyAiLimit() {
  const value = process.env.MUSE_AI_DAILY_ATTEMPT_CAP || '100'
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 100) {
    throw new SharedStoryError('MUSE_AI_DAILY_ATTEMPT_CAP must be an integer from 1 to 100.', 503)
  }
  return Number(value)
}

export function aiDayBucket() { return `ai:${new Date(Date.now()).toISOString().slice(0, 10)}` }

export async function reportOperation(event: OperationEvent) {
  // Fixed event codes only: never persist request bodies, paths, error text or credentials.
  console.error(JSON.stringify({ event, time: new Date(Date.now()).toISOString() }))
  try {
    const minute = Math.floor(Date.now() / 60000)
    await storeOperationAlert(`${event}:${minute}`, event)
    return true
  } catch {
    console.error(JSON.stringify({ event: 'error-report-persistence-failed' }))
    return false
  }

}

export async function apiSafety(req: NextApiRequest, res: NextApiResponse, publicPlayerActions = false) {
  const maintenance = process.env.MUSE_MAINTENANCE_MODE
  if (maintenance && maintenance !== 'false') {
    res.setHeader('Retry-After', '60')
    res.status(503).json({ error: maintenance === 'true' ? 'Stories are temporarily paused for maintenance. Your saved writing is unchanged.' : 'Maintenance configuration is invalid.' })
    return false
  }
  if (req.headers.origin) {
    try {
      if (new URL(String(req.headers.origin)).host !== req.headers.host) {
        res.status(403).json({ error: 'Cross-origin requests are not allowed.' })
        return false
      }
    } catch {
      res.status(403).json({ error: 'Invalid request origin.' })
      return false
    }
  }
  try {
    await limitApiRequest(req, res)
    const action = req.body?.action
    const invalidCreatorAttempt = !!process.env.MUSE_CREATOR_ACCESS_CODE &&
      req.headers['x-muse-creator-code'] !== process.env.MUSE_CREATOR_ACCESS_CODE &&
      !(publicPlayerActions && ['open', 'next', 'guess', 'hint', 'adventure', 'media'].includes(String(action)))
    if (invalidCreatorAttempt) await limitApiRequest(req, res, 'creator')
    return true
  } catch (error) {
    res.status(error instanceof SharedStoryError ? error.status : 503).json({
      error: error instanceof SharedStoryError ? error.message : 'Request safety controls unavailable.'
    })
    return false
  }
}

export async function reserveAiAttempt() {
  const cap = dailyAiLimit()
  const warning = Math.max(1, Math.ceil(cap * 0.8))
  const tomorrow = new Date(Date.now())
  tomorrow.setUTCHours(24, 0, 0, 0)
  const reservation = await consumeOperation(aiDayBucket(), cap, tomorrow.toISOString(), warning)
  if (reservation.notify) await reportOperation('ai-budget-warning')
  if (!reservation.allowed) {
    await reportOperation('ai-budget-exhausted')
    throw new SharedStoryError('Daily AI attempt limit reached. Read, listen with browser voices, use hints or return tomorrow (UTC).', 429)
  }
}

export async function limitApiRequest(req: NextApiRequest, res: NextApiResponse, kind: 'api' | 'creator' | 'report' = 'api') {
  const address = process.env.VERCEL
    ? String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
    : req.socket?.remoteAddress || 'local'
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MUSE_CREATOR_ACCESS_CODE
  if (process.env.VERCEL && !salt) throw new SharedStoryError('Request safety controls are not configured.', 503)
  const digest = salt ? createHmac('sha256', salt).update(address).digest('hex') : createHash('sha256').update(address).digest('hex')
  const interval = kind === 'creator' ? 600000 : 60000
  const cap = kind === 'creator' ? 20 : kind === 'report' ? 5 : 120
  const bucket = `${kind}:${digest}:${Math.floor(Date.now() / interval)}`
  const expiresAt = new Date((Math.floor(Date.now() / interval) + 1) * interval).toISOString()
  const result = await consumeOperation(bucket, cap, expiresAt)
  if (!result.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000))))
    throw new SharedStoryError('Too many requests. Please wait and try again.', 429)
  }
}

export async function productionOperationStatus() {
  const cap = dailyAiLimit()
  const status = await operationStatus(aiDayBucket())
  const operator = process.env.NEXT_PUBLIC_MUSE_OPERATOR_NAME?.trim()
  const support = process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL?.trim()
  const backupTime = Date.parse(process.env.MUSE_BACKUP_LAST_VERIFIED_AT || '')
  return {
    day: new Date(Date.now()).toISOString().slice(0, 10), used: status.used, cap,
    remaining: Math.max(0, cap - status.used), warningAt: Math.ceil(cap * 0.8), alerts: status.alerts,
    alertDelivery: 'Server logs and this private status endpoint; no external notification service configured.',
    publicBetaReady: false,
    blockers: [
      ...(!operator ? ['Public operator name is missing.'] : []),
      ...(!support || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support) ? ['Valid support email is missing.'] : []),
      ...(!Number.isFinite(backupTime) || backupTime > Date.now() || Date.now() - backupTime > 86400000 ? ['No recent operator-attested backup verification.'] : []),
      'Privacy/terms and production recovery require operator review and a restore rehearsal.'
    ],
    backupVerification: Number.isFinite(backupTime) ? 'Operator-attested timestamp, not an independently verified backup guarantee.' : 'Not configured.'
  }
}

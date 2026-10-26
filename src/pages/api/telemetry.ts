import type { NextApiRequest, NextApiResponse } from 'next'
import { limitApiRequest, reportOperation } from '../../lib/operations'
import { SharedStoryError } from '../../lib/sharedStory'
import { requireAccount } from '../../lib/accountAuth'

const EVENTS = new Set(['story-created'])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }) }
  try {
    await limitApiRequest(req, res, 'report')
    const event = req.body?.event
    if (!EVENTS.has(event)) return res.status(400).json({ error: 'Unsupported telemetry event.' })
    if (event === 'story-created' && !await requireAccount(req, res)) return
    if (!await reportOperation(event)) return res.status(503).json({ error: 'Telemetry could not be saved.' })
    return res.status(202).json({ accepted: true })
  } catch (error) {
    return res.status(error instanceof SharedStoryError ? error.status : 503).json({ error: 'Telemetry unavailable.' })
  }
}

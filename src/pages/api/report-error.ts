import type { NextApiRequest, NextApiResponse } from 'next'
import { limitApiRequest, reportOperation } from '../../lib/operations'
import { SharedStoryError } from '../../lib/sharedStory'

export const config = { api: { bodyParser: { sizeLimit: '1kb' } } }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }) }
  try {
    if (typeof req.headers.origin !== 'string' || new URL(req.headers.origin).host !== req.headers.host) {
      return res.status(403).json({ error: 'Same-origin reporting required.' })
    }
  } catch { return res.status(403).json({ error: 'Invalid request origin.' }) }
  try {
    await limitApiRequest(req, res, 'report')
    if (!req.body || req.body.event !== 'client-render-failure' || Object.keys(req.body).some(key => key !== 'event')) {
      return res.status(400).json({ error: 'Only a fixed event code is accepted.' })
    }
    if (!await reportOperation('client-render-failure')) return res.status(503).json({ error: 'Error report could not be saved.' })
    return res.status(202).json({ accepted: true })
  } catch (error) {
    return res.status(error instanceof SharedStoryError ? error.status : 503).json({ error: 'Error reporting unavailable.' })
  }
}

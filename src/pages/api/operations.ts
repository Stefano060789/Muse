import type { NextApiRequest, NextApiResponse } from 'next'
import { requireOperationsAccess } from '../../lib/operationsAccess'
import { productionOperationStatus, limitApiRequest } from '../../lib/operations'
import { SharedStoryError } from '../../lib/sharedStory'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }) }
  if (!process.env.MUSE_OPERATIONS_ACCESS_CODE) return res.status(503).json({ error: 'Private operations access must be configured.' })
  try {
    await limitApiRequest(req, res, 'creator')
    if (!requireOperationsAccess(req, res)) return
    return res.status(200).json(await productionOperationStatus())
  } catch (error) {
    return res.status(error instanceof SharedStoryError ? error.status : 503).json({ error: 'Operations status unavailable.' })
  }
}

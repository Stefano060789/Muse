import { createHash, timingSafeEqual } from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'

export function requireCreatorAccess(req: NextApiRequest, res: NextApiResponse): boolean {
  const code = process.env.MUSE_CREATOR_ACCESS_CODE
  if (!code && !process.env.VERCEL) return true
  res.setHeader('Cache-Control', 'no-store')
  if (!code || code.length < 16 || code.length > 512) {
    console.error('Creator access configuration is missing or has an invalid length.')
    res.status(503).json({ error: 'Private creator access is not configured. Recipient links can still be played.' })
    return false
  }
  const provided = req.headers['x-muse-creator-code']
  if (typeof provided !== 'string' || provided.length > 512 ||
      !timingSafeEqual(createHash('sha256').update(provided).digest(), createHash('sha256').update(code).digest())) {
    res.status(401).json({ error: 'Enter your private creator access code to create or manage stories. Recipient links do not need this code.' })
    return false
  }
  return true
}

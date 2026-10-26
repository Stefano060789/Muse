import { createHash, timingSafeEqual } from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'

export function requireOperationsAccess(req: NextApiRequest, res: NextApiResponse): boolean {
  const code = process.env.MUSE_OPERATIONS_ACCESS_CODE
  if (!code && process.env.NODE_ENV !== 'production' && !process.env.VERCEL) return true
  res.setHeader('Cache-Control', 'no-store')
  if (!code || code.length < 16 || code.length > 512) {
    console.error('Operations access configuration is missing or has an invalid length.')
    res.status(503).json({ error: 'Private operations access is not configured.' })
    return false
  }
  const provided = req.headers['x-muse-operations-code']
  if (typeof provided !== 'string' || provided.length > 512 ||
      !timingSafeEqual(createHash('sha256').update(provided).digest(), createHash('sha256').update(code).digest())) {
    res.status(401).json({ error: 'Enter the private operations access code.' })
    return false
  }
  return true
}

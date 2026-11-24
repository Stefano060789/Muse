import { timingSafeEqual } from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { maintainChapterVideos } from '../../lib/chapterVideoArchive'

export const config = { maxDuration: 180 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const secret = process.env.MUSE_CHAPTER_VIDEO_CRON_SECRET
  if (!secret || secret.length < 32) return res.status(503).json({ error: 'Video maintenance is not configured.' })
  const supplied = Buffer.from(req.headers.authorization || '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ error: 'Unauthorized.' })
  }
  try {
    await maintainChapterVideos()
    return res.status(200).json({ completed: true })
  } catch {
    console.error(JSON.stringify({ event: 'chapter-video-maintenance-failure' }))
    return res.status(503).json({ error: 'Video maintenance failed. Check operational logs.' })
  }
}

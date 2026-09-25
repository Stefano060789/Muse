import type { NextApiRequest, NextApiResponse } from 'next'
import { extractProfileKeypoints, readMuseProfile, writeMuseProfile } from '../../lib/profileStorage'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json(await readMuseProfile())
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const about = String(req.body?.about || '').trim()
  if (!about) return res.status(400).json({ error: 'Tell us something about yourself first' })

  const profile = {
    about,
    keypoints: extractProfileKeypoints(about),
    updatedAt: new Date().toISOString()
  }

  await writeMuseProfile(profile)
  return res.status(200).json(profile)
}

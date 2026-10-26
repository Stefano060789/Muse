import type { NextApiRequest, NextApiResponse } from 'next'
import { extractProfileKeypoints, readMuseProfile, writeMuseProfile } from '../../lib/profileStorage'
import { requireAccount } from '../../lib/accountAuth'
import { apiSafety } from '../../lib/operations'

export const config = { api: { bodyParser: { sizeLimit: '20kb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!await apiSafety(req, res)) return
  const account = await requireAccount(req, res)
  if (!account) return
  if (req.method === 'GET') {
    return res.status(200).json(await readMuseProfile(account.id))
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

  await writeMuseProfile(profile, account.id)
  return res.status(200).json(profile)
}

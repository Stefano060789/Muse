import type { NextApiRequest, NextApiResponse } from 'next'
import { createStoryArc, type StoryArc } from '../../lib/story'
import { readMuseProfile } from '../../lib/profileStorage'
import { readStoryState, writeStoryState } from '../../lib/storyStorage'
import { requireAccount } from '../../lib/accountAuth'
import { apiSafety, reportOperation } from '../../lib/operations'

export const config = { api: { bodyParser: { sizeLimit: '20kb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!await apiSafety(req, res)) return
  const account = await requireAccount(req, res)
  if (!account) return
  if (req.method === 'GET') {
    const story = await readStoryState(account.id)
    return res.status(200).json(story ?? null)
  }

  if (req.method === 'POST') {
    const { action, templateKey, partnerA, partnerB, response } = req.body || {}

    if (action === 'create') {
      const profile = await readMuseProfile(account.id)
      const story = createStoryArc(
        templateKey || 'letter-in-the-drawer',
        partnerA || 'You',
        partnerB || 'Your partner',
        profile?.keypoints || []
      ) as StoryArc
      await writeStoryState(story as any, account.id)
      await reportOperation('story-created')
      return res.status(200).json(story)
    }

    if (action === 'answer') {
      const current = await readStoryState(account.id)
      if (!current) return res.status(404).json({ error: 'No story found' })

      const trimmed = String(response || '').trim()
      if (!trimmed) return res.status(400).json({ error: 'Response is required' })

      const updated = { ...current, responses: { ...current.responses } }
      updated.responses[String(current.currentBeat + 1)] = trimmed
      updated.currentBeat = Math.min(current.currentBeat + 1, current.beats.length - 1)

      await writeStoryState(updated as any, account.id)
      return res.status(200).json(updated)
    }

    return res.status(400).json({ error: 'Unsupported action' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

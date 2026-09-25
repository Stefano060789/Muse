import type { NextApiRequest, NextApiResponse } from 'next'
import { createStoryArc, type StoryArc } from '../../lib/story'
import { readStoryState, writeStoryState } from '../../lib/storyStorage'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const story = await readStoryState()
    return res.status(200).json(story ?? null)
  }

  if (req.method === 'POST') {
    const { action, templateKey, partnerA, partnerB, response } = req.body || {}

    if (action === 'create') {
      const story = createStoryArc(templateKey || 'letter-in-the-drawer', partnerA || 'You', partnerB || 'Your partner') as StoryArc
      await writeStoryState(story as any)
      return res.status(200).json(story)
    }

    if (action === 'answer') {
      const current = await readStoryState()
      if (!current) return res.status(404).json({ error: 'No story found' })

      const trimmed = String(response || '').trim()
      if (!trimmed) return res.status(400).json({ error: 'Response is required' })

      const updated = { ...current, responses: { ...current.responses } }
      updated.responses[String(current.currentBeat + 1)] = trimmed
      updated.currentBeat = Math.min(current.currentBeat + 1, current.beats.length - 1)

      await writeStoryState(updated as any)
      return res.status(200).json(updated)
    }

    return res.status(400).json({ error: 'Unsupported action' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

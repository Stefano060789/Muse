import type { NextApiRequest, NextApiResponse } from 'next'
import { parsePersonalStoryRequest, generatePersonalStory } from '../../lib/personalStoryGenerator'
import { SharedStoryError } from '../../lib/sharedStory'
import { storyProviderConfig } from '../../lib/storyProvider'
import { storyDatabase, reserveStoryRequest } from '../../lib/storyRequestLimits'

export const config = { api: { bodyParser: { sizeLimit: '20kb' } }, maxDuration: 60 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host) {
        return res.status(403).json({ error: 'Cross-origin story requests are not allowed.' })
      }
    } catch {
      return res.status(403).json({ error: 'Invalid request origin.' })
    }
  }
  try {
    const input = parsePersonalStoryRequest(req.body)
    storyProviderConfig()
    await reserveStoryRequest(storyDatabase(), req, 'generate')
    const story = await generatePersonalStory(input)
    return res.status(200).json(story)
  } catch (error) {
    if (error instanceof SharedStoryError) return res.status(error.status).json({ error: error.message })
    console.error('Personal story request failed', error instanceof Error ? error.name : 'Unknown error')
    return res.status(500).json({ error: 'Could not generate your story. Please try again later.' })
  }
}

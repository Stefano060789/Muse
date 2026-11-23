import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAccount } from '../../lib/accountAuth'
import { requireAccountProviderConsent } from '../../lib/providerConsent'
import { apiSafety, reportOperation } from '../../lib/operations'
import { SharedStoryError } from '../../lib/sharedStory'
import { createHeygenReel, downloadHeygenReel, heygenConfigured, heygenReelStatus } from '../../lib/heygenReel'
import { storyDatabase } from '../../lib/storyRequestLimits'
import { adventureGlobalCap } from '../../lib/sharedAdventure'
import { journeyCapability, journeyHash, journeyIdentifier } from '../../lib/personalJourney'

export const config = { api: { bodyParser: { sizeLimit: '16kb' }, responseLimit: false }, maxDuration: 60 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!await apiSafety(req, res)) return
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    if (req.body?.action === 'availability') return res.status(200).json({ available: heygenConfigured() })
    if (req.body?.action === 'create') {
      if (account.id !== 'local-development') requireAccountProviderConsent(account.permissions)
      const chapter = await storyDatabase().personalJourney({
        operation: 'view', id: journeyIdentifier(req.body.storyId), accountId: account.id,
        capabilityHash: journeyHash(journeyCapability(req.body.storyCapability)), cap: adventureGlobalCap()
      })
      if (chapter.snapshot.pending || chapter.snapshot.status !== 'concluded' || !chapter.record.turn?.concluded) {
        throw new SharedStoryError('Finish this chapter before creating a video.', 409)
      }
      return res.status(200).json(await createHeygenReel(account.id, req.body))
    }
    if (req.body?.action === 'status') {
      const result = await heygenReelStatus(account.id, req.body.token)
      return res.status(200).json({ status: result.status })
    }
    if (req.body?.action === 'video') {
      const video = await downloadHeygenReel(account.id, req.body.token)
      res.setHeader('Content-Type', 'video/mp4')
      res.setHeader('Content-Disposition', 'attachment; filename="muse-story-reel.mp4"')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      return res.status(200).send(video)
    }
    throw new SharedStoryError('Unsupported reel action.', 400)
  } catch (error) {
    await reportOperation('request-failure')
    return res.status(error instanceof SharedStoryError ? error.status : 503).json({
      error: error instanceof SharedStoryError ? error.message : 'Reel generation is temporarily unavailable.'
    })
  }
}

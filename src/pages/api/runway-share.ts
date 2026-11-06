import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAccount } from '../../lib/accountAuth'
import { requireAccountProviderConsent } from '../../lib/providerConsent'
import { apiSafety, reportOperation } from '../../lib/operations'
import { SharedStoryError } from '../../lib/sharedStory'
import { createRunwayJob, publicRunwayJob, refreshRunwayJob, runwayIdentifier } from '../../lib/runwayShare'
import { readRunwayVideo, runwayJob, runwayJobs } from '../../lib/runwayShareStore'

export const config = { api: { bodyParser: { sizeLimit: '2mb' }, responseLimit: false }, maxDuration: 60 }

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
    if (req.body?.action === 'quote') {
      return res.status(503).json({
        error: 'Runway video generation is disabled pending commercial entitlement review.',
        code: 'runway-commercial-entitlement-required'
      })
    }
    if (req.body?.action === 'list') return res.status(200).json({ jobs: (await runwayJobs(account.id)).map(publicRunwayJob) })
    if (req.body?.action === 'create') {
      if (account.id !== 'local-development') requireAccountProviderConsent(account.permissions)
      return res.status(200).json(await createRunwayJob(account.id, req.body))
    }
    const id = runwayIdentifier(req.body?.id)
    if (req.body?.action === 'status') return res.status(200).json(await refreshRunwayJob(account.id, id))
    if (req.body?.action === 'video') {
      const job = await runwayJob(account.id, id)
      if (job.status !== 'ready') throw new SharedStoryError('The cinematic clip is not ready.', 409)
      const bytes = await readRunwayVideo(job)
      res.setHeader('Content-Type', 'video/mp4')
      res.setHeader('Content-Disposition', 'attachment; filename="muse-cinematic-highlight.mp4"')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      return res.status(200).send(Buffer.from(bytes))
    }
    throw new SharedStoryError('Unsupported cinematic action.', 400)
  } catch (error) {
    await reportOperation('request-failure')
    return res.status(error instanceof SharedStoryError ? error.status : 503).json({
      error: error instanceof SharedStoryError ? error.message : 'Cinematic sharing is temporarily unavailable. Your saved card is unchanged.'
    })
  }
}

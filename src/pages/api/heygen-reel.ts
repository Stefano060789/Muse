import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAccount } from '../../lib/accountAuth'
import { requireAccountProviderConsent } from '../../lib/providerConsent'
import { apiSafety, reportOperation } from '../../lib/operations'
import { SharedStoryError } from '../../lib/sharedStory'
import { createHeygenReel, downloadHeygenReel, heygenConfigured, heygenReelStatus, heygenReferenceReservation, validateHeygenReelRequest } from '../../lib/heygenReel'
import { storyDatabase } from '../../lib/storyRequestLimits'
import { adventureGlobalCap } from '../../lib/sharedAdventure'
import { journeyCapability, journeyHash, journeyIdentifier } from '../../lib/personalJourney'
import {
  beginChapterVideo, chapterVideoArchiveEnabled, chapterVideoStatus, deleteChapterVideo,
  finishChapterVideoStart, listChapterVideos, readChapterVideo, registerChapterVideoAsset
} from '../../lib/chapterVideoArchive'

export const config = { api: { bodyParser: { sizeLimit: '3mb' }, responseLimit: false }, maxDuration: 180 }

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
    if (req.body?.action === 'availability') return res.status(200).json({
      available: heygenConfigured(), archive: chapterVideoArchiveEnabled(),
      referenceReservation: chapterVideoArchiveEnabled() ? heygenReferenceReservation() : null
    })
    if (req.body?.action === 'create') {
      if (account.id !== 'local-development') requireAccountProviderConsent(account.permissions)
      const chapter = await storyDatabase().personalJourney({
        operation: 'view', id: journeyIdentifier(req.body.storyId), accountId: account.id,
        capabilityHash: journeyHash(journeyCapability(req.body.storyCapability)), cap: adventureGlobalCap()
      })
      if (chapter.snapshot.pending || chapter.snapshot.status !== 'concluded' || !chapter.record.turn?.concluded) {
        throw new SharedStoryError('Finish this chapter before creating a video.', 409)
      }
      if (!chapterVideoArchiveEnabled()) return res.status(200).json(await createHeygenReel(account.id, req.body))
      validateHeygenReelRequest(req.body)
      const video = await beginChapterVideo(account.id, chapter.record.id,
        chapter.record.input.chapter?.rootId ?? chapter.record.id, chapter.record.input.chapter?.number ?? 1)
      let reel: Awaited<ReturnType<typeof createHeygenReel>>
      try { reel = await createHeygenReel(account.id, req.body, asset => registerChapterVideoAsset(video, asset)) }
      catch (error) { await finishChapterVideoStart(video, null); throw error }
      await finishChapterVideoStart(video, reel.token)
      return res.status(200).json({ token: video.id, status: 'pending' })
    }
    if (req.body?.action === 'archive-list') return res.status(200).json(await listChapterVideos(account.id))
    if (req.body?.action === 'archive-status') return res.status(200).json(await chapterVideoStatus(account.id, req.body.id))
    if (req.body?.action === 'archive-delete') {
      await deleteChapterVideo(account.id, req.body.id)
      return res.status(200).json({ deleted: true })
    }
    if (req.body?.action === 'archive-video') {
      const video = await readChapterVideo(account.id, req.body.id, req.body.offset ?? 0)
      res.setHeader('Content-Type', 'video/mp4')
      res.setHeader('Content-Disposition', 'attachment; filename="muse-chapter-video.mp4"')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('X-Muse-Video-Total', String(video.total))
      return res.status(200).send(video.bytes)
    }
    if (req.body?.action === 'status') {
      if (typeof req.body.token === 'string' && /^[0-9a-f-]{36}$/i.test(req.body.token)) {
        const video = await chapterVideoStatus(account.id, req.body.token)
        const status = video.status === 'ready' ? 'completed'
          : video.status === 'failed' || video.status === 'unknown' ? 'failed' : 'pending'
        return res.status(200).json({ status })
      }
      const result = await heygenReelStatus(account.id, req.body.token)
      return res.status(200).json({ status: result.status })
    }
    if (req.body?.action === 'video') {
      let video: Buffer
      if (typeof req.body.token === 'string' && /^[0-9a-f-]{36}$/i.test(req.body.token)) {
        const part = await readChapterVideo(account.id, req.body.token, req.body.offset ?? 0)
        video = part.bytes
        res.setHeader('X-Muse-Video-Total', String(part.total))
      } else video = await downloadHeygenReel(account.id, req.body.token)
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

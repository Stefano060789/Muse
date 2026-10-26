import { randomBytes } from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { parsePersonalStoryRequest, generatePersonalStory } from '../../lib/personalStoryGenerator'
import { SharedStoryError } from '../../lib/sharedStory'
import { storyProviderConfig } from '../../lib/storyProvider'
import { storyDatabase, reserveStoryRequest } from '../../lib/storyRequestLimits'
import { requireAccount } from '../../lib/accountAuth'
import { adventureGlobalCap } from '../../lib/sharedAdventure'
import { apiSafety, reportOperation } from '../../lib/operations'
import { requireProviderConsent } from '../../lib/providerConsent'
import {
  generateJourneyOpening, generateJourneyTurn, journeyCapability, journeyHash, journeyIdentifier,
  parseJourneyAction, parseJourneyInput, publicJourney, type JourneyOperation
} from '../../lib/personalJourney'

export const config = { api: { bodyParser: { sizeLimit: '20kb' } }, maxDuration: 60 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!await apiSafety(req, res)) return
  const account = await requireAccount(req, res)
  if (!account) return
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
    if (req.body?.mode === 'journey' && req.body?.action === 'library') {
      const db = storyDatabase()
      const cap = adventureGlobalCap()
      const records = await db.listPersonalJourneys(account.id)
      const stories = await Promise.all(records.map(async record => {
        const capability = randomBytes(32).toString('hex')
        const result = await db.personalJourney({
          operation: 'view', id: record.id, accountId: account.id,
          capabilityHash: journeyHash(capability), cap
        })
        return publicJourney(result, capability).story
      }))
      return res.status(200).json({ stories: stories.filter(Boolean) })
    }
    if (!(req.body?.mode === 'journey' && ['resume', 'delete'].includes(req.body?.action))) requireProviderConsent(req.body)
    if (req.body?.mode === 'journey') {
      const body = req.body as Record<string, unknown>
      const capability = journeyCapability(body.capability)
      const id = journeyIdentifier(body.id)
      const db = storyDatabase()
      if (body.action === 'delete') {
        if (!await db.deletePersonalJourney(id, journeyHash(capability), account.id)) {
          throw new SharedStoryError('Journey: session unavailable', 404)
        }
        return res.status(200).json({ deleted: true })
      }
      const common = { id, capabilityHash: journeyHash(capability), accountId: account.id, cap: adventureGlobalCap() }
      if (body.action === 'resume') {
        return res.status(200).json(publicJourney(await db.personalJourney({ ...common, operation: 'view' }), capability))
      }
      let operation: JourneyOperation
      if (body.action === 'create') {
        const input = parseJourneyInput(body)
        operation = {
          ...common, operation: 'create', requestId: id, input,
          fingerprint: journeyHash(JSON.stringify(input))
        }
      } else if (body.action === 'respond') {
        const current = await db.personalJourney({ ...common, operation: 'view' })
        operation = { ...common, operation: 'reserve', ...parseJourneyAction(body, current.record) }
      } else throw new SharedStoryError('Unsupported personal journey action.')
      const reserved = await db.personalJourney(operation)
      if (reserved.status !== 'reserved') return res.status(200).json(publicJourney(reserved, capability))
      try {
        storyProviderConfig()
        if (operation.operation === 'create') await reserveStoryRequest(db, req, 'generate')
        const generated = operation.operation === 'create'
          ? { opening: await generateJourneyOpening(reserved.record.input) }
          : { turn: await generateJourneyTurn(reserved.record) }
        const finished = await db.personalJourney({ ...common, operation: 'finish', requestId: operation.requestId, fingerprint: operation.fingerprint, ...generated })
        if (operation.operation === 'create') await reportOperation('story-created')
        return res.status(200).json(publicJourney(finished, capability))
      } catch (error) {
        console.error('Personal journey attempt failed', error instanceof Error ? error.name : 'Unknown error')
        await reportOperation('request-failure')
        try {
          await db.personalJourney({ ...common, operation: 'finish', requestId: operation.requestId, fingerprint: operation.fingerprint, failed: true })
        } catch (completionError) {
          console.error('Personal journey failure reconciliation could not mark the attempt', completionError instanceof Error ? completionError.name : 'Unknown error')
        }
        let current
        try { current = publicJourney(await db.personalJourney({ ...common, operation: 'view' }), capability) } catch (reconciliationError) {
          console.error('Personal journey progress reconciliation failed', reconciliationError instanceof Error ? reconciliationError.name : 'Unknown error')
        }
        return res.status(error instanceof SharedStoryError ? error.status : 503).json({
          error: 'This story attempt could not complete. Its allowance was consumed. Reconcile to see saved progress; no automatic retries or refunds.',
          ...current
        })
      }
    }
    const input = parsePersonalStoryRequest(req.body)
    storyProviderConfig()
    await reserveStoryRequest(storyDatabase(), req, 'generate')
    const story = await generatePersonalStory(input)
    await reportOperation('story-created')
    return res.status(200).json(story)
  } catch (error) {
    if (!(error instanceof SharedStoryError) || error.status >= 500) await reportOperation('request-failure')
    if (error instanceof SharedStoryError) return res.status(error.status).json({ error: error.message })
    console.error('Personal story request failed', error instanceof Error ? error.name : 'Unknown error')
    return res.status(500).json({ error: 'The story request failed. Please try again later.' })
  }
}

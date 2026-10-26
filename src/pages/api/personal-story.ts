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
import { requireRomanceConfirmation, StoryRomanceError } from '../../lib/storyRomance'
import {
  generateJourneyOpening, generateJourneyTurn, journeyCapability, journeyHash, journeyIdentifier,
  parseJourneyAction, parseJourneyClosingAction, parseJourneyInput, nextChapterInput, publicJourney, type JourneyInput, type JourneyOperation
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
      if (body.action === 'create' || body.action === 'continue') {
        let input: JourneyInput
        if (body.action === 'continue') {
          const sourceId = journeyIdentifier(body.sourceId)
          if (sourceId === id) throw new SharedStoryError('A new chapter must have its own story ID.')
          const parent = await db.personalJourney({
            ...common, id: sourceId, capabilityHash: journeyHash(journeyCapability(body.sourceCapability)), operation: 'view'
          })
          if (parent.snapshot.pending) throw new SharedStoryError('Wait for the current chapter to finish.', 409)
          try {
            requireRomanceConfirmation(parent.record.input.romance, body.romanceConfirmed)
          } catch (error) {
            if (error instanceof StoryRomanceError) throw new SharedStoryError(error.message, error.status)
            throw error
          }
          input = nextChapterInput(parent.record, body.duration)
        } else input = parseJourneyInput(body)
        operation = {
          ...common, operation: 'create', requestId: id, input,
          fingerprint: journeyHash(JSON.stringify(input))
        }
      } else if (body.action === 'respond' || body.action === 'conclude') {
        const current = await db.personalJourney({ ...common, operation: 'view' })
        const action = body.action === 'conclude'
          ? parseJourneyClosingAction(body, current.record) : parseJourneyAction(body, current.record)
        operation = { ...common, operation: 'reserve', ...action }
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
          error: `${error instanceof SharedStoryError ? error.message : 'This story attempt could not complete.'} No automatic retry was made. Your draft and any saved scenes are kept.`,
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

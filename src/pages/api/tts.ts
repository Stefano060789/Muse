import type { NextApiRequest, NextApiResponse } from 'next'
import { legacyNarrationStyle, parseNarrationMetadata } from '../../lib/narration'
import { requireAccount } from '../../lib/accountAuth'
import { apiSafety, reserveAiAttempt, reportOperation } from '../../lib/operations'
import { SharedStoryError } from '../../lib/sharedStory'
import { requireCloudAudioConsent } from '../../lib/providerConsent'
import { synthesizeGoogleNarration } from '../../lib/googleNarration'

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const provider = process.env.NEXT_PUBLIC_NARRATION_PROVIDER?.trim().toLowerCase()
  if (provider === 'elevenlabs') {
    return res.status(503).json({
      error: 'ElevenLabs narration is disabled pending commercial entitlement review.',
      code: 'elevenlabs-commercial-entitlement-required'
    })
  }
  if (provider !== 'google') {
    return res.status(503).json({ error: 'Provider narration is disabled. Use browser narration.' })
  }
  if (!await apiSafety(req, res)) return
  const account = await requireAccount(req, res)
  if (!account) return
  try { requireCloudAudioConsent(req.body, account.permissions) } catch (error) {
    return res.status(error instanceof SharedStoryError ? error.status : 400).json({ error: error instanceof SharedStoryError ? error.message : 'Google Cloud narration requires consent to send text and use a paid attempt.' })
  }
  const text = String(req.body?.text || '').trim()
  const mood = String(req.body?.mood || '').trim()
  let style = legacyNarrationStyle(mood)
  let language = 'en-US'
  try {
    const metadata = parseNarrationMetadata({
      narrationStyle: req.body?.narrationStyle ?? style,
      narrationLanguage: req.body?.narrationLanguage ?? 'en-US'
    }, true)
    style = metadata.narrationStyle!
    language = metadata.narrationLanguage!
  } catch {
    return res.status(400).json({ error: 'Invalid narration style or language.' })
  }

  if (!text || text.length > 12000) {
    return res.status(400).json({ error: 'Text is required (maximum 12000 characters)' })
  }
  try {
    const audio = await synthesizeGoogleNarration(req.body?.text, language, style, { reserveAttempt: reserveAiAttempt })
    res.setHeader('Content-Type', 'audio/mpeg')
    return res.status(200).send(Buffer.from(audio))
  } catch (error) {
    if (!(error instanceof SharedStoryError) || error.status >= 500) await reportOperation('provider-failure')
    return res.status(error instanceof SharedStoryError ? error.status : 503).json({
      error: error instanceof SharedStoryError ? error.message : 'Google narration is unavailable.',
      code: error instanceof SharedStoryError && 'code' in error ? error.code : 'google-provider-failure'
    })
  }
}

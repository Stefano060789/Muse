import type { NextApiRequest, NextApiResponse } from 'next'
import { legacyNarrationStyle, parseNarrationMetadata } from '../../lib/narration'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (process.env.NEXT_PUBLIC_NARRATION_PROVIDER !== 'elevenlabs') {
    return res.status(503).json({ error: 'Provider narration is disabled. Use browser narration.' })
  }
  const apiKey = process.env.ELEVEN_API_KEY
  const voiceId = process.env.ELEVEN_VOICE_ID
  const text = String(req.body?.text || '').trim()
  const mood = String(req.body?.mood || '').trim()
  let style = legacyNarrationStyle(mood)
  try {
    const metadata = parseNarrationMetadata({
      narrationStyle: req.body?.narrationStyle ?? style,
      narrationLanguage: req.body?.narrationLanguage ?? 'en-US'
    }, true)
    style = metadata.narrationStyle!
  } catch {
    return res.status(400).json({ error: 'Invalid narration style or language.' })
  }

  if (!apiKey || !voiceId) {
    return res.status(503).json({ error: 'Text-to-speech is not configured' })
  }

  if (!text || text.length > 12000) {
    return res.status(400).json({ error: 'Text is required (maximum 12000 characters)' })
  }

  let response: Response
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: style === 'calm' ? 0.75 : style === 'adventurous' || style === 'playful' ? 0.4 : 0.55,
          similarity_boost: 0.75,
          style: style === 'adventurous' || style === 'playful' ? 0.35 : style === 'curious' || style === 'suspenseful' ? 0.2 : 0.1,
          use_speaker_boost: true
        }
      }),
      signal: controller.signal
    })
  } catch {
    return res.status(503).json({ error: 'Text-to-speech provider is unavailable' })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    return res.status(503).json({ error: 'Text-to-speech provider is unavailable' })
  }

  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).send(Buffer.from(await response.arrayBuffer()))
}

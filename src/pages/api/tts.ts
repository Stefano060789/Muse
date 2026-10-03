import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ELEVEN_API_KEY
  const voiceId = process.env.ELEVEN_VOICE_ID
  const text = String(req.body?.text || '').trim()
  const mood = String(req.body?.mood || '').trim()

  if (!apiKey || !voiceId) {
    return res.status(503).json({ error: 'Text-to-speech is not configured' })
  }

  if (!text) {
    return res.status(400).json({ error: 'Text is required' })
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
          stability: mood === 'relaxed' ? 0.75 : mood === 'adventure' ? 0.4 : 0.55,
          similarity_boost: 0.75,
          style: mood === 'adventure' ? 0.35 : mood === 'curious' ? 0.2 : 0.1,
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
    const details = await response.text()
    return res.status(response.status).json({ error: `Text-to-speech provider error: ${details}` })
  }

  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).send(Buffer.from(await response.arrayBuffer()))
}

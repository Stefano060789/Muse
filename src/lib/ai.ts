type GenerateParams = {
  userName?: string
  preferredGenres?: string[]
  moodHint?: string | null
  cyclePhase?: string | null
  voice?: string
}

async function callGroq(prompt: string) {
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) throw new Error('LLM_API_KEY not set')
  const body = { model: 'groq-llama2-13b-chat', input: prompt, max_output_tokens: 220 }
  const res = await fetch('https://api.groq.ai/v1/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Groq error: ${res.status} ${await res.text()}`)
  const json = await res.json()
  const output = (json?.output && Array.isArray(json.output) && json.output[0]?.content) || json?.output_text || json?.text || ''
  return String(output).trim()
}

function hashCode(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return String(Math.abs(h))
}

export async function generateDailyMessage(params: GenerateParams) {
  const voice = params.voice || 'Gentle Poet'
  const name = params.userName || 'friend'
  const genres = (params.preferredGenres || []).slice(0, 3).join(', ')
  const mood = params.moodHint || ''
  const cycle = params.cyclePhase || ''
  const prompt = [
    `System: You are Muse, a short-form narrative companion. Produce one uplifting, non-medical, non-diagnostic message under 120 words.`,
    `Constraints: Avoid direct copyrighted quotes longer than two lines. Do not impersonate living public figures. Keep output under 120 words.`,
    `Voice archetype: ${voice}`,
    `User name: ${name}`,
    `Preferred genres: ${genres}`,
    `Mood hint: ${mood}`,
    `Cycle phase: ${cycle}`,
    `Structure: 1) One-sentence hook (optional). 2) One practical suggestion. 3) One short poetic closing line.`,
    `Output: Plain text only.`
  ].join('\n\n')
  const content = await callGroq(prompt)
  return { content, promptHash: hashCode(prompt) }
}

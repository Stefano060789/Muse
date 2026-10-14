import { SharedStoryError } from './sharedStory'
import { reserveAiAttempt, reportOperation } from './operations'

export function storyProviderConfig() {
  const provider = (process.env.LLM_PROVIDER || 'ANTHROPIC').trim().toUpperCase()
  if (!['ANTHROPIC', 'OPENAI', 'GROQ'].includes(provider)) {
    throw new SharedStoryError('Unsupported story provider. Choose ANTHROPIC, OPENAI or GROQ.', 503)
  }
  const keyName = provider === 'ANTHROPIC' ? 'ANTHROPIC_API_KEY' : provider === 'OPENAI' ? 'OPENAI_API_KEY' : 'LLM_API_KEY'
  const key = process.env[keyName] || (provider === 'OPENAI' ? process.env.LLM_API_KEY : undefined)
  if (!key) throw new SharedStoryError(`AI story generation is not configured. Set ${keyName} on the server.`, 503)
  return {
    provider,
    key,
    endpoint: provider === 'ANTHROPIC' ? 'https://api.anthropic.com/v1/messages'
      : provider === 'OPENAI' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions',
    model: process.env.LLM_MODEL || (provider === 'ANTHROPIC' ? 'claude-haiku-5-5'
      : provider === 'OPENAI' ? 'gpt-4.1-mini' : 'llama-3.3-70b-versatile')
  }
}

export async function generateStoryJson(system: string, input: unknown, maxTokens: number): Promise<unknown> {
  const { provider, key, endpoint, model } = storyProviderConfig()
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 9000 || system.length > 40000 || JSON.stringify(input).length > 100000) {
    throw new SharedStoryError('AI request exceeds the permitted size.', 400)
  }
  await reserveAiAttempt()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: provider === 'ANTHROPIC'
        ? { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }
        : { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(provider === 'ANTHROPIC' ? {
        model, max_tokens: maxTokens, system,
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content: JSON.stringify(input) }]
      } : {
        model, max_tokens: maxTokens, temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(input) }]
      }),
      signal: controller.signal
    })
    if (!response.ok) {
      const message = response.status === 429 ? 'The AI provider usage or rate limit was reached. Please try again later.'
        : response.status === 401 || response.status === 403 ? 'The AI provider rejected the server credentials. Check the API key and account access.'
        : 'The AI provider could not generate this story. Please try again later.'
      throw new SharedStoryError(message, response.status === 429 ? 429 : 502)
    }
    const result = await response.json()
    let raw: unknown
    if (provider === 'ANTHROPIC') {
      if (result.stop_reason === 'refusal') throw new SharedStoryError('The AI provider declined this story. Please change the brief.', 422)
      if (result.stop_reason !== 'end_turn') throw new SharedStoryError('The AI provider did not finish the story. Please try again.', 502)
      raw = Array.isArray(result.content)
        ? result.content.filter((block: { type?: unknown; text?: unknown }) => block?.type === 'text' && typeof block.text === 'string')
          .map((block: { text: string }) => block.text).join('')
        : undefined
    } else {
      if (result?.choices?.[0]?.finish_reason && result.choices[0].finish_reason !== 'stop') {
        throw new SharedStoryError('The AI provider did not finish the story. Please try again.', 502)
      }
      raw = result?.choices?.[0]?.message?.content
    }
    if (typeof raw !== 'string' || !raw.trim()) throw new SharedStoryError('The AI provider returned no story.', 502)
    try {
      return JSON.parse(raw)
    } catch {
      throw new SharedStoryError('The AI provider returned invalid story JSON. Please try again.', 502)
    }
  } catch (error) {
    await reportOperation('provider-failure')
    if (error instanceof SharedStoryError) throw error
    throw new SharedStoryError('The AI provider is unavailable or timed out. Please try again later.', 503)
  } finally {
    clearTimeout(timeout)
  }
}

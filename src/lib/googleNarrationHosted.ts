import { createClient } from '@supabase/supabase-js'
import { SharedStoryError } from './sharedStory'

export type GoogleHostedResult = { status: 'reserved' | 'ready' | 'pending' | 'failed' | 'exhausted' | 'saved'; audio?: string }

export function googleHostedConfigured(): boolean {
  return process.env.STORY_STORAGE === 'supabase' &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function googleHostedOperation(
  action: 'reserve' | 'finish' | 'fail', hash: string, token: string,
  characters = 0, limit = 0, audio: Uint8Array | null = null
): Promise<GoogleHostedResult> {
  try {
    if (!googleHostedConfigured()) throw new Error('Missing hosted storage')
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) }
    })
    const { data, error } = await client.rpc('muse_google_narration', {
      p_action: action, p_hash: hash, p_token: token, p_characters: characters, p_limit: limit,
      p_audio: audio ? Buffer.from(audio).toString('base64') : null
    })
    if (error || !data || !['reserved', 'ready', 'pending', 'failed', 'exhausted', 'saved'].includes(data.status) ||
        (data.status === 'ready' && (typeof data.audio !== 'string' || data.audio.length > 16 * 1024 * 1024))) {
      throw new Error('Invalid hosted response')
    }
    return data as GoogleHostedResult
  } catch {
    throw Object.assign(new SharedStoryError('Private Google narration storage is unavailable. Apply the Google narration migration.', 503),
      { code: 'google-storage-unavailable' })
  }
}

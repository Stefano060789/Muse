import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'
import { SharedStoryError } from './sharedStory'
import { storyStorageMode } from './storyRepository'

export type AccountUser = { id: string; email: string | undefined; displayName?: string }

export async function requireAccount(req: NextApiRequest, res: NextApiResponse): Promise<AccountUser | null> {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL && storyStorageMode() === 'sqlite') {
    return { id: 'local-development', email: undefined }
  }

  const authorization = req.headers.authorization
  const match = typeof authorization === 'string' ? /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization) : null
  if (!match) {
    res.status(401).json({ error: 'Sign in to create or manage your stories.' })
    return null
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new SharedStoryError('Account authentication is not configured.', 503)

  try {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await client.auth.getUser(match[1])
    if (error || !data.user?.id) {
      res.status(401).json({ error: 'Your sign-in has expired. Sign in again to continue.' })
      return null
    }
    const metadata = data.user.user_metadata
    const displayName = metadata && typeof metadata.display_name === 'string'
      ? metadata.display_name.trim().slice(0, 40)
      : ''
    return { id: data.user.id, email: data.user.email, ...(displayName ? { displayName } : {}) }
  } catch (error) {
    if (error instanceof SharedStoryError) throw error
    throw new SharedStoryError('Account authentication is temporarily unavailable.', 503)
  }
}

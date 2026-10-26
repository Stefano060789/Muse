import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

export async function accountAuthorization(): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error('Could not verify your sign-in. Please sign in again.')
  return data.session ? `Bearer ${data.session.access_token}` : null
}

export async function accountFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const authorization = await accountAuthorization()
  const headers = new Headers(init.headers)
  if (authorization) headers.set('Authorization', authorization)
  return fetch(input, { ...init, headers })
}

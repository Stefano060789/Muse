import { createClient } from '@supabase/supabase-js'
import type { SharedStoryBrief, SharedStoryContent } from './sharedStory'
import { normalizeSharedAnswer, SharedStoryError } from './sharedStory'
import { storyStorageError } from './storyStorageErrors'
export { storyStorageError } from './storyStorageErrors'

export type StoredStory = {
  id: string
  owner_hash: string
  play_hash: string
  brief: SharedStoryBrief
  content: SharedStoryContent
  answer_normalized: string
  alternative_answers_normalized?: string[]
  expires_at: string
}
export type PlayerState = { current_scene: number; solved: boolean; revealed_hints: number }
export type RequestKind = 'generate' | 'guess'
export interface StoryRepository {
  insert(story: StoredStory): Promise<void>
  findUnexpired(id: string): Promise<StoredStory | null>
  delete(id: string): Promise<void>
  rotate(id: string, playHash: string): Promise<void>
  advance(id: string, sessionHash: string, action: 'open' | 'next' | 'guess' | 'hint', guess: string, playHash?: string): Promise<PlayerState>
  reserve(clientHash: string, kind: RequestKind): Promise<boolean>
}

export function storyStorageMode(): 'supabase' | 'sqlite' {
  const mode = process.env.STORY_STORAGE ?? 'supabase'
  if (mode !== 'supabase' && mode !== 'sqlite') {
    console.error('Private story storage configuration failed: unsupported STORY_STORAGE')
    throw new SharedStoryError('Unknown STORY_STORAGE. Choose supabase or sqlite.', 503)
  }
  if (mode === 'sqlite' && process.env.VERCEL) {
    console.error('Private story storage configuration failed: SQLite on Vercel')
    throw new SharedStoryError('SQLite story storage is not supported on Vercel. Configure Supabase instead.', 503)
  }
  return mode
}

export function storyRepository(): StoryRepository {
  if (storyStorageMode() === 'sqlite') {
    // Keep node:sqlite out of the hosted Supabase execution path.
    const { SqliteStoryRepository } = require('./sqliteStoryRepository') as typeof import('./sqliteStoryRepository')
    return new SqliteStoryRepository()
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new SharedStoryError('Private story storage and usage limits are not configured. Configure Supabase and apply shared-stories.sql.', 503)
  }
  const db = (() => {
    try {
      return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    } catch (error) {
      throw storyStorageError(error)
    }
  })()
  return {
    async insert(story) {
      const { error } = await db.from('shared_stories').insert({
        ...story, alternative_answers_normalized: (story.brief.alternativeAnswers ?? []).map(normalizeSharedAnswer)
      })
      if (error) throw storyStorageError(error)
    },
    async findUnexpired(id) {
      const { data, error } = await db.from('shared_stories').select('*').eq('id', id).gt('expires_at', new Date().toISOString()).maybeSingle()
      if (error) throw storyStorageError(error)
      return data as StoredStory | null
    },
    async delete(id) {
      const { error } = await db.from('shared_stories').delete().eq('id', id)
      if (error) throw storyStorageError(error)
    },
    async rotate(id, playHash) {
      const { error } = await db.from('shared_stories').update({ play_hash: playHash }).eq('id', id)
      if (error) throw storyStorageError(error)
    },
    async advance(id, sessionHash, action, guess, playHash) {
      const { data, error } = await db.rpc('advance_shared_story', {
        story_uuid: id, session_hash: sessionHash, action_name: action, guess_normalized: guess, expected_play_hash: playHash ?? null
      })
      if (error) {
        if (error.message === 'Story unavailable') throw new SharedStoryError('This story link is invalid, expired, or has been deleted.', 404)
        if (error.message === 'Player session unavailable') throw new SharedStoryError('Player session is invalid. Reopen the story link.')
        if (error.message === 'Guess limit reached' || error.message === 'Please wait before guessing again') throw new SharedStoryError(error.message, 429)
        throw storyStorageError(error)
      }
      if (!data || typeof data.current_scene !== 'number' || typeof data.solved !== 'boolean' || !Number.isInteger(data.revealed_hints) || data.revealed_hints < 0) throw storyStorageError()
      return data
    },
    async reserve(clientHash, kind) {
      const { data, error } = await db.rpc('reserve_shared_story_request', { client_hash: clientHash, request_kind: kind })
      if (error) throw storyStorageError(error)
      return data === true
    }
  }
}

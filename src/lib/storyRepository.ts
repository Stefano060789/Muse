import { createClient } from '@supabase/supabase-js'
import type { SharedStoryBrief, SharedStoryContent } from './sharedStory'
import { normalizeSharedAnswer, SharedStoryError } from './sharedStory'
import { storyStorageError } from './storyStorageErrors'
import type { AdventureRequest, AdventureResult } from './sharedAdventure'
import type { JourneyOperation, JourneyResult } from './personalJourney'
import { SHARED_MEDIA_PENDING_GRACE_MS as MEDIA_PENDING_GRACE_MS, type SharedMediaRecord } from './sharedStoryMedia'
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
export type PlayerState = { current_scene: number; solved: boolean; skipped: boolean; revealed_hints: number }
export type RequestKind = 'generate' | 'guess' | 'upload'
export interface StoryRepository {
  insert(story: StoredStory): Promise<void>
  findUnexpired(id: string): Promise<StoredStory | null>
  delete(id: string): Promise<void>
  rotate(id: string, playHash: string): Promise<void>
  advance(id: string, sessionHash: string, action: 'open' | 'next' | 'guess' | 'hint' | 'skip', guess: string, playHash?: string): Promise<PlayerState>
  reserve(clientHash: string, kind: RequestKind): Promise<boolean>
  adventure(request: AdventureRequest): Promise<AdventureResult>
  personalJourney(request: JourneyOperation): Promise<JourneyResult>
  deletePersonalJourney(id: string, capabilityHash: string): Promise<boolean>
  /** Registers a pending upload; false when the story's attempt allowance is used up. */
  mediaBegin(record: SharedMediaRecord, maxAttempts: number): Promise<boolean>
  mediaGet(id: string): Promise<SharedMediaRecord | null>
  mediaReady(storyId: string): Promise<SharedMediaRecord | null>
  /** Atomically promotes a pending upload and queues any previous ready object for purge. */
  mediaActivate(storyId: string, id: string): Promise<void>
  /** Deletes one upload (or the ready media when id is omitted); its object is queued for purge. */
  mediaDiscard(storyId: string, id?: string): Promise<void>
  /** Expires abandoned uploads, then returns queued object keys whose rows no longer exist. */
  mediaPurgeQueue(limit: number): Promise<string[]>
  mediaPurged(keys: string[]): Promise<void>
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
  const media = () => db.from('shared_story_media')
  return {
    async deletePersonalJourney(id, capabilityHash) {
      const { data, error } = await db.rpc('muse_delete_personal_journey', { p_id: id, p_capability_hash: capabilityHash })
      if (error) throw storyStorageError(error)
      if (typeof data !== 'boolean') throw storyStorageError()
      return data
    },
    async mediaBegin(record, maxAttempts) {
      const { data, error } = await db.rpc('muse_begin_shared_media', { media: record, max_attempts: maxAttempts })
      if (error) {
        if (error.message === 'Story unavailable') throw new SharedStoryError('This story link is invalid, expired, or has been deleted.', 404)
        throw new SharedStoryError('Private media storage is unavailable. Apply supabase/shared-story-media.sql before enabling photo and video reveals.', 503)
      }
      return data === true
    },
    async mediaGet(id) {
      const { data, error } = await media().select('*').eq('id', id).maybeSingle()
      if (error) throw storyStorageError(error)
      return data as SharedMediaRecord | null
    },
    async mediaReady(storyId) {
      const { data, error } = await media().select('*').eq('story_id', storyId).eq('status', 'ready').maybeSingle()
      // Before shared-story-media.sql is applied no story can have media; keep legacy playback working.
      if (error && (error.code === '42P01' || error.code === 'PGRST205')) return null
      if (error) throw storyStorageError(error)
      return data as SharedMediaRecord | null
    },
    async mediaActivate(storyId, id) {
      const { error } = await db.rpc('muse_activate_shared_media', { story_uuid: storyId, media_uuid: id })
      if (error) {
        if (error.message === 'Media unavailable') throw new SharedStoryError('This upload is no longer available. Choose the file again.', 409)
        throw storyStorageError(error)
      }
    },
    async mediaDiscard(storyId, id) {
      const query = media().delete().eq('story_id', storyId)
      const { error } = await (id ? query.eq('id', id) : query.eq('status', 'ready'))
      if (error) throw storyStorageError(error)
    },
    async mediaPurgeQueue(limit) {
      const cutoff = new Date(Date.now() - MEDIA_PENDING_GRACE_MS).toISOString()
      const expired = await media().delete().eq('status', 'pending').lt('upload_expires_at', cutoff)
      // Routine sweeps stay quiet before shared-story-media.sql; the strict pre-generation check (limit 0) still fails.
      if (expired.error && limit > 0 && (expired.error.code === '42P01' || expired.error.code === 'PGRST205')) return []
      if (expired.error) throw storyStorageError(expired.error)
      const { data, error } = await db.from('shared_story_media_purge').select('object_key').order('queued_at').limit(limit)
      if (error) throw storyStorageError(error)
      return (data ?? []).map(row => String(row.object_key))
    },
    async mediaPurged(keys) {
      if (!keys.length) return
      const now = new Date().toISOString()
      const { error } = await db.from('shared_story_media_purge').delete().in('object_key', keys).lte('retain_until', now)
      if (error) throw storyStorageError(error)
      const retry = await db.from('shared_story_media_purge').update({ queued_at: now }).in('object_key', keys)
      if (retry.error) throw storyStorageError(retry.error)
    },
    async personalJourney(request) {
      const { data, error } = await db.rpc('muse_personal_journey', { input: request })
      if (error) {
        const message = error.message ?? ''
        if (message.startsWith('Journey:')) throw new SharedStoryError(message, message.includes('unavailable') ? 404 : message.includes('daily cap') ? 429 : 409)
        throw new SharedStoryError('Personal journey storage is unavailable. Apply supabase/personal-journeys.sql before enabling hosted journeys.', 503)
      }
      if (data?.unavailable === true) throw new SharedStoryError('Journey: session unavailable', 404)
      if (!data?.record || !data?.snapshot || !Number.isInteger(data.snapshot.revision)) throw new SharedStoryError('Personal journey storage returned invalid state.', 503)
      return data as JourneyResult
    },
    async adventure(request) {
      const { data, error } = await db.rpc('muse_shared_adventure', { input: request })
      if (error) {
        const message = error.message ?? ''
        if (message.startsWith('Adventure:')) throw new SharedStoryError(message, message.includes('unavailable') ? 404 : message.includes('AI budget reached') ? 429 : 409)
        throw new SharedStoryError('Adventure storage is unavailable. Apply supabase/shared-adventures.sql before enabling hosted adventures.', 503)
      }
      if (!data?.view || !Number.isInteger(data.view.revision)) throw new SharedStoryError('Adventure storage returned invalid state.', 503)
      return data as AdventureResult
    },
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
        if (error.message === 'Skipping is not enabled') throw new SharedStoryError('The sender chose Solve to unlock for this story.', 403)
        if (error.message === 'Guess limit reached' || error.message === 'Please wait before guessing again') throw new SharedStoryError(error.message, 429)
        throw storyStorageError(error)
      }
      if (!data || typeof data.current_scene !== 'number' || typeof data.solved !== 'boolean' || typeof data.skipped !== 'boolean' || !Number.isInteger(data.revealed_hints) || data.revealed_hints < 0) {
        throw new SharedStoryError('Shared story state is unavailable. Apply supabase/shared-story-help.sql before deploying this version.', 503)
      }
      return data
    },
    async reserve(clientHash, kind) {
      const { data, error } = await db.rpc('reserve_shared_story_request', { client_hash: clientHash, request_kind: kind })
      if (error) throw storyStorageError(error)
      return data === true
    }
  }
}

import { createClient } from '@supabase/supabase-js'
import type { SharedStoryBrief, SharedStoryContent } from './sharedStory'
import { normalizeSharedAnswer, SharedStoryError } from './sharedStory'
import { storyStorageError } from './storyStorageErrors'
import type { AdventureRequest, AdventureResult } from './sharedAdventure'
import type { JourneyOperation, JourneyResult } from './personalJourney'
import type { StudioRequest, StudioResult } from './studioNarration'
import type { SharedStoryProgress } from './sharedStoryProgress'
import {
  SHARED_MEDIA_PENDING_GRACE_MS as MEDIA_PENDING_GRACE_MS, type SharedGiftReply, type SharedMediaRecord,
  type SharedVoiceRecord
} from './sharedStoryMedia'
export { storyStorageError } from './storyStorageErrors'

function isMissingGiftSchema(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  return ['42P01', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(String(error.code))
}

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
  listRetained(after: string | null, limit: number): Promise<StoredStory[]>
  progress(storyId: string, adventure?: boolean): Promise<SharedStoryProgress>
  studio(request: StudioRequest): Promise<StudioResult>
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
  giftReady(): Promise<void>
  giftReplies(storyId: string): Promise<SharedGiftReply[]>
  giftReply(storyId: string, sessionHash: string, message: string): Promise<SharedGiftReply>
  voiceBegin(record: SharedVoiceRecord, maxAttempts: number): Promise<boolean>
  voiceGet(id: string): Promise<SharedVoiceRecord | null>
  voiceReady(storyId: string): Promise<SharedVoiceRecord | null>
  voiceActivate(storyId: string, id: string): Promise<void>
  voiceDiscard(storyId: string, id?: string): Promise<void>
  voicePurgeQueue(limit: number): Promise<string[]>
  voicePurged(keys: string[]): Promise<void>
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
  const voice = () => db.from('shared_story_voice')
  const giftUnavailable = () => new SharedStoryError('Gift features are not available in storage yet. Apply supabase/shared-story-gifts.sql, then retry.', 503)
  const giftStorageError = (error: unknown) => isMissingGiftSchema(error) ? giftUnavailable() : storyStorageError(error)
  return {
    async listRetained(after, limit) {
      let query = db.from('shared_stories').select('*').gt('expires_at', new Date().toISOString()).order('id', { ascending: true }).limit(limit)
      if (after) query = query.gt('id', after)
      const { data, error } = await query
      if (error) throw storyStorageError(error)
      if (!Array.isArray(data)) throw storyStorageError()
      return data as StoredStory[]
    },
    async progress(storyId, adventure = false) {
      const sessions = () => db.from('shared_story_sessions')
      const [active, solved, skipped, furthest] = await Promise.all([
        sessions().select('story_id', { count: 'exact', head: true }).eq('story_id', storyId).eq('solved', false).eq('skipped', false),
        sessions().select('story_id', { count: 'exact', head: true }).eq('story_id', storyId).eq('solved', true),
        sessions().select('story_id', { count: 'exact', head: true }).eq('story_id', storyId).eq('solved', false).eq('skipped', true),
        sessions().select('current_scene').eq('story_id', storyId).order('current_scene', { ascending: false }).limit(1)
      ])
      for (const result of [active, solved, skipped, furthest]) if (result.error) throw storyStorageError(result.error)
      const counts = [active.count, solved.count, skipped.count]
      if (counts.some(count => count === null || !Number.isSafeInteger(count) || count < 0) || !Array.isArray(furthest.data)) throw storyStorageError()
      let scene = furthest.data.length ? furthest.data[0].current_scene : null
      if (scene !== null && (!Number.isSafeInteger(scene) || scene < 0)) throw storyStorageError()
      if (adventure) {
        const completed = new Map<string, number>()
        for (let offset = 0; ; offset += 1000) {
          const result = await db.from('muse_adventure_requests').select('player_hash,request_id')
            .eq('story_id', storyId).eq('status', 'done')
            .order('player_hash').order('request_id').range(offset, offset + 999)
          if (result.error || !Array.isArray(result.data)) throw storyStorageError(result.error)
          for (const row of result.data) {
            if (typeof row.player_hash !== 'string') throw storyStorageError()
            completed.set(row.player_hash, (completed.get(row.player_hash) || 0) + 1)
          }
          if (result.data.length < 1000) break
        }
        scene = scene === null ? null : 0
        for (const count of completed.values()) scene = Math.max(scene ?? 0, count)
      }
      return { opened: active.count! + solved.count! + skipped.count!, inProgress: active.count!, solved: solved.count!, skipped: skipped.count!, furthestScene: scene }
    },
    async studio(request) {
      const { data, error } = await db.rpc('muse_studio_narration', { request })
      if (error) {
        if (error.message === 'Studio budget exhausted') throw new SharedStoryError('Studio lifetime character budget exhausted.', 429)
        throw new SharedStoryError('Studio storage is unavailable. Apply supabase/shared-story-studio.sql; no automatic retry is permitted.', 503)
      }
      if (!data || !Array.isArray(data.records) || !Array.isArray(data.keys) || typeof data.reserved !== 'boolean') {
        throw new SharedStoryError('Studio storage returned an invalid result.', 503)
      }
      return data as StudioResult
    },
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
    async giftReady() {
      const [storyColumns, replies, voiceRows] = await Promise.all([
        db.from('shared_stories').select('voice_attempts').limit(0),
        db.from('shared_story_replies').select('story_id').limit(0),
        voice().select('id').limit(0)
      ])
      const error = storyColumns.error ?? replies.error ?? voiceRows.error
      if (error) throw giftStorageError(error)
    },
    async giftReplies(storyId) {
      const { data, error } = await db.from('shared_story_replies').select('message,created_at')
        .eq('story_id', storyId).order('created_at', { ascending: true })
      if (error) throw giftStorageError(error)
      return (data ?? []).map(row => ({ message: String(row.message), createdAt: String(row.created_at) }))
    },
    async giftReply(storyId, sessionHash, message) {
      const { data, error } = await db.rpc('muse_submit_shared_story_reply', {
        p_story_uuid: storyId, p_session_hash: sessionHash, p_reply_message: message
      })
      if (error) {
        if (error.message === 'Reply unavailable') throw new SharedStoryError('Replies are unavailable for this story or player session.', 403)
        if (error.message === 'Reply limit reached') throw new SharedStoryError('This story has reached its limit of 100 replies.', 429)
        if (error.message === 'Story unavailable') throw new SharedStoryError('This story link is invalid, expired, or has been deleted.', 404)
        throw giftStorageError(error)
      }
      const row = Array.isArray(data) ? data[0] : data
      if (!row || typeof row.message !== 'string' || typeof row.created_at !== 'string') throw storyStorageError()
      return { message: row.message, createdAt: row.created_at }
    },
    async voiceBegin(record, maxAttempts) {
      const { data, error } = await db.rpc('muse_begin_shared_story_voice', { voice_record: record, max_attempts: maxAttempts })
      if (error) {
        if (error.message === 'Story unavailable') throw new SharedStoryError('This story link is invalid, expired, or has been deleted.', 404)
        throw giftStorageError(error)
      }
      return data === true
    },
    async voiceGet(id) {
      const { data, error } = await voice().select('*').eq('id', id).maybeSingle()
      if (error && (error.code === 'PGRST205' || error.code === '42P01')) return null
      if (error) throw giftStorageError(error)
      return data as SharedVoiceRecord | null
    },
    async voiceReady(storyId) {
      const { data, error } = await voice().select('*').eq('story_id', storyId).eq('status', 'ready').maybeSingle()
      if (error) throw giftStorageError(error)
      return data as SharedVoiceRecord | null
    },
    async voiceActivate(storyId, id) {
      const { error } = await db.rpc('muse_activate_shared_story_voice', { story_uuid: storyId, voice_uuid: id })
      if (error) {
        if (error.message === 'Voice unavailable') throw new SharedStoryError('This voice upload is no longer available. Choose the recording again.', 409)
        throw giftStorageError(error)
      }
    },
    async voiceDiscard(storyId, id) {
      const query = voice().delete().eq('story_id', storyId)
      const { error } = await (id ? query.eq('id', id) : query.eq('status', 'ready'))
      if (error) throw giftStorageError(error)
    },
    async voicePurgeQueue(limit) {
      const cutoff = new Date(Date.now() - MEDIA_PENDING_GRACE_MS).toISOString()
      const expired = await voice().delete().eq('status', 'pending').lt('upload_expires_at', cutoff)
      if (expired.error) {
        if (expired.error.code === 'PGRST205' || expired.error.code === '42P01') return []
        throw storyStorageError(expired.error)
      }
      const { data, error } = await db.from('shared_story_voice_purge').select('object_key')
        .lte('retain_until', new Date().toISOString()).order('queued_at').limit(limit)
      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') return []
        throw storyStorageError(error)
      }
      return (data ?? []).map(row => String(row.object_key))
    },
    async voicePurged(keys) {
      if (!keys.length) return
      const now = new Date().toISOString()
      const { error } = await db.from('shared_story_voice_purge').delete().in('object_key', keys).lte('retain_until', now)
      if (error) throw storyStorageError(error)
      const retry = await db.from('shared_story_voice_purge').update({ queued_at: now }).in('object_key', keys)
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

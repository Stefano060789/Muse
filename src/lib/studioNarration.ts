import { createHash, randomUUID } from 'crypto'
import { SharedStoryError } from './sharedStory'
import type { StoredStory, StoryRepository } from './storyRepository'
import { sharedMediaStore, type SharedMediaStore } from './sharedMediaStore'
import { googleNarrationConfiguration, googleVoice, synthesizeGoogleNarration } from './googleNarration'

// A reservation is never retried or refunded: an interrupted provider request may
// already have been billed. The budget is lifetime characters, not a dollar quote.
export const STUDIO_MAX_BYTES = 5 * 1024 * 1024
export type StudioRecord = {
  story_id: string; scene_index: number; fingerprint: string; object_key: string
  status: 'pending' | 'ready' | 'failed'; characters: number; size: number; created_at: string
}
export type StudioRequest =
  | { operation: 'status'; storyId: string }
  | { operation: 'reserve'; record: StudioRecord; budget: number }
  | { operation: 'finish'; record: StudioRecord; failed?: boolean }
  | { operation: 'audio'; storyId: string; sceneIndex: number; sessionHash?: string; playHash?: string }
  | { operation: 'purge' }
  | { operation: 'purged'; keys: string[] }
export type StudioResult = { records: StudioRecord[]; reserved: boolean; keys: string[] }

export function studioConfiguration() {
  if (process.env.NEXT_PUBLIC_NARRATION_PROVIDER !== 'google') {
    return { available: false, budget: 0, voice: '', reason: process.env.NEXT_PUBLIC_NARRATION_PROVIDER === 'elevenlabs'
      ? 'commercial-entitlement-required' : 'disabled' }
  }
  const google = googleNarrationConfiguration()
  return { available: process.env.MUSE_STUDIO_NARRATION_ENABLED === 'true' && google.available,
    budget: google.budget, voice: 'google-wavenet',
    reason: process.env.MUSE_STUDIO_NARRATION_ENABLED !== 'true' ? 'disabled' : google.reason }
}

export function studioScene(story: StoredStory, sceneIndex: unknown) {
  if (story.brief.adventure) throw new SharedStoryError('Studio supports prepared scenes only, not live adventures.', 409)
  if (!Number.isInteger(sceneIndex) || Number(sceneIndex) < 0 || Number(sceneIndex) >= story.content.scenes.length ||
      story.content.scenes.length > 12) throw new SharedStoryError('Choose a prepared scene index.', 400)
  const scene = story.content.scenes[Number(sceneIndex)]
  const text = [scene.title, scene.body, scene.clue].join('\n\n')
  if (!text.trim() || text.length > 5000) throw new SharedStoryError('Studio scenes must contain 1–5000 characters.', 409)
  return { text, sceneIndex: Number(sceneIndex) }
}

export async function studioStatus(db: StoryRepository, story: StoredStory) {
  const config = studioConfiguration()
  if (process.env.NEXT_PUBLIC_NARRATION_PROVIDER === 'google') {
    googleVoice(story.content.narrationLanguage || 'en-US', story.content.narrationStyle || 'warm')
  }
  const { records } = await db.studio({ operation: 'status', storyId: story.id })
  return {
    available: config.available && !story.brief.adventure,
    reason: story.brief.adventure ? 'prepared-scenes-only' : config.reason,
    contract: 'scene-title-body-clue-v1', sceneCount: story.content.scenes.length,
    maxSceneCharacters: 5000, budgetUnit: 'lifetime-reserved-characters',
    scenes: records.map(row => ({ sceneIndex: row.scene_index, status: row.status, size: row.size, mime: 'audio/mpeg' }))
  }
}

export async function generateStudioScene(db: StoryRepository, story: StoredStory, index: unknown, store = sharedMediaStore()) {
  const { text, sceneIndex } = studioScene(story, index)
  // Ready cache playback/reuse does not require a paid provider to remain enabled.
  const existing = (await db.studio({ operation: 'status', storyId: story.id })).records.find(row => row.scene_index === sceneIndex)
  if (existing) {
    if (existing.status !== 'ready') throw new SharedStoryError('Studio reservation is pending or failed; it cannot be retried.', 409)
    return studioStatus(db, story)
  }
  const config = studioConfiguration()
  if (!config.available) throw new SharedStoryError(config.reason === 'commercial-entitlement-required'
    ? 'ElevenLabs Studio narration is disabled pending commercial entitlement review.'
    : 'Studio narration is disabled or not configured.', 503)
  if (process.env.NEXT_PUBLIC_NARRATION_PROVIDER === 'google') {
    googleVoice(story.content.narrationLanguage || 'en-US', story.content.narrationStyle || 'warm')
  }
  await store.ready('audio/mpeg')
  const record: StudioRecord = {
    story_id: story.id, scene_index: sceneIndex,
    fingerprint: createHash('sha256').update(JSON.stringify([text, 'google-wavenet',
      config.voice, story.content.narrationLanguage, story.content.narrationStyle, 'mp3_44100_128'])).digest('hex'),
    object_key: `stories/${story.id}/${randomUUID()}.mp3`, status: 'pending',
    characters: text.length, size: 0, created_at: new Date().toISOString()
  }
  const reservation = await db.studio({ operation: 'reserve', record, budget: config.budget })
  if (!reservation.reserved) throw new SharedStoryError('This scene already has a Studio reservation. Refresh its status.', 409)
  try {
    const audio = await synthesizeGoogleNarration(text, story.content.narrationLanguage || 'en-US', story.content.narrationStyle || 'warm')
    await store.write(record.object_key, audio, 'audio/mpeg')
    await db.studio({ operation: 'finish', record: { ...record, size: audio.length } })
  } catch (error) {
    // Preserve the charged reservation even when storage/provider completion is uncertain.
    await db.studio({ operation: 'finish', record, failed: true }).catch(() => undefined)
    throw error instanceof SharedStoryError ? error : new SharedStoryError('Studio storage failed. The charged reservation cannot be retried.', 503)
  }
  return studioStatus(db, story)
}

export async function readStudioAudio(db: StoryRepository, story: StoredStory, index: unknown, sessionHash?: string, store = sharedMediaStore()) {
  const { sceneIndex } = studioScene(story, index)
  const { records } = await db.studio({ operation: 'audio', storyId: story.id, sceneIndex,
    ...(sessionHash ? { sessionHash, playHash: story.play_hash } : {}) })
  const record = records[0]
  if (!record || record.status !== 'ready') throw new SharedStoryError('Studio audio is unavailable for this scene or session.', 404)
  const audio = await store.read(record.object_key, STUDIO_MAX_BYTES)
  if (!audio || audio.length !== Number(record.size)) throw new SharedStoryError('Prepared Studio audio is missing or invalid.', 503)
  // Recheck revocation after the storage read. No signed URLs bypass subsequent authorization.
  const checked = await db.studio({ operation: 'audio', storyId: story.id, sceneIndex,
    ...(sessionHash ? { sessionHash, playHash: story.play_hash } : {}) })
  if (!checked.records.length) throw new SharedStoryError('Studio audio access was revoked.', 404)
  return audio
}

export async function purgeStudioAudio(db: StoryRepository, store?: SharedMediaStore) {
  const { keys } = await db.studio({ operation: 'purge' })
  if (!keys.length) return
  await (store ?? sharedMediaStore()).remove(keys)
  await db.studio({ operation: 'purged', keys })
}

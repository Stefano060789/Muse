import { createHash, randomUUID } from 'crypto'
import { SharedStoryError } from './sharedStory'
import type { StoredStory, StoryRepository } from './storyRepository'
import { sharedMediaStore, type SharedMediaStore } from './sharedMediaStore'
import { googleNarrationConfiguration, googleVoice, synthesizeGoogleNarration } from './googleNarration'

// A reservation is never retried or refunded: an interrupted provider request may
// already have been billed. The budget is lifetime characters, not a dollar quote.
export const STUDIO_MAX_BYTES = 5 * 1024 * 1024
export const STUDIO_MODEL = 'eleven_multilingual_v2'
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
  if (process.env.NEXT_PUBLIC_NARRATION_PROVIDER === 'google') {
    const google = googleNarrationConfiguration()
    return { available: process.env.MUSE_STUDIO_NARRATION_ENABLED === 'true' && google.available,
      budget: google.budget, voice: 'google-wavenet', key: '',
      reason: process.env.MUSE_STUDIO_NARRATION_ENABLED !== 'true' ? 'disabled' : google.reason }
  }
  const raw = process.env.MUSE_STUDIO_NARRATION_BUDGET_CHARACTERS
  const budget = raw && /^[1-9]\d*$/.test(raw) ? Number(raw) : 0
  const voice = process.env.ELEVEN_VOICE_ID || ''
  const key = process.env.ELEVEN_API_KEY || ''
  const enabled = process.env.MUSE_STUDIO_NARRATION_ENABLED === 'true'
  const configured = Number.isSafeInteger(budget) && budget > 0 && budget <= 100000000 &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(voice) && Boolean(key.trim())
  return { available: enabled && configured, budget, voice, key,
    reason: !enabled ? 'disabled' : !configured ? 'configuration-required' : null }
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

async function synthesize(text: string, config: ReturnType<typeof studioConfiguration>): Promise<Uint8Array> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 40000)
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.voice}?output_format=mp3_44100_128`, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'xi-api-key': config.key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: STUDIO_MODEL })
    })
    if (!response.ok || !response.body || response.headers.get('content-type')?.split(';')[0] !== 'audio/mpeg') {
      throw new Error('Invalid provider response')
    }
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > STUDIO_MAX_BYTES) throw new Error('Audio too large')
        chunks.push(value)
      }
    } finally { await reader.cancel().catch(() => undefined) }
    const audio = Buffer.concat(chunks)
    if (audio.length < 3 || !(audio.subarray(0, 3).toString() === 'ID3' || (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0))) {
      throw new Error('Invalid MP3')
    }
    return audio
  } catch {
    throw new SharedStoryError('Studio provider failed. This reservation remains charged and cannot be retried.', 502)
  } finally { clearTimeout(timeout) }
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
  if (!config.available) throw new SharedStoryError('Studio generation is disabled or lacks credentials and an explicit character budget.', 503)
  if (process.env.NEXT_PUBLIC_NARRATION_PROVIDER === 'google') {
    googleVoice(story.content.narrationLanguage || 'en-US', story.content.narrationStyle || 'warm')
  }
  await store.ready('audio/mpeg')
  const record: StudioRecord = {
    story_id: story.id, scene_index: sceneIndex,
    fingerprint: createHash('sha256').update(JSON.stringify([text, process.env.NEXT_PUBLIC_NARRATION_PROVIDER === 'google' ? 'google-wavenet' : STUDIO_MODEL,
      config.voice, story.content.narrationLanguage, story.content.narrationStyle, 'mp3_44100_128'])).digest('hex'),
    object_key: `stories/${story.id}/${randomUUID()}.mp3`, status: 'pending',
    characters: text.length, size: 0, created_at: new Date().toISOString()
  }
  const reservation = await db.studio({ operation: 'reserve', record, budget: config.budget })
  if (!reservation.reserved) throw new SharedStoryError('This scene already has a Studio reservation. Refresh its status.', 409)
  try {
    const audio = process.env.NEXT_PUBLIC_NARRATION_PROVIDER === 'google'
      ? await synthesizeGoogleNarration(text, story.content.narrationLanguage || 'en-US', story.content.narrationStyle || 'warm')
      : await synthesize(text, config)
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

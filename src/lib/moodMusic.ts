import type { SceneMood } from './sceneMood'
import { normalizeSceneMood } from './sceneMood'

export type MoodMusicTrack = {
  mood: SceneMood
  src: `/audio/moods/${string}`
  title: string
  source: string
  license: string
  attribution: string
}

// Intentionally empty by default: no music bed is played unless a licensed local track is explicitly listed.
export const MOOD_MUSIC_MANIFEST: ReadonlyArray<MoodMusicTrack> = []

export function moodMusicTrack(mood?: unknown): MoodMusicTrack | undefined {
  const normalized = normalizeSceneMood(mood)
  return normalized ? MOOD_MUSIC_MANIFEST.find(track => track.mood === normalized) : undefined
}
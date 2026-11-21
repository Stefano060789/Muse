import type { NarrationStyle } from './narration'
import type { AmbientSound } from './storyAmbience'

export const SCENE_MOODS = ['reflection', 'mystery', 'adventure', 'tension', 'joy', 'sorrow', 'nature', 'romance'] as const
export type SceneMood = typeof SCENE_MOODS[number]

const FALLBACK_BY_STYLE: Record<NarrationStyle, SceneMood> = {
  calm: 'reflection',
  warm: 'reflection',
  curious: 'mystery',
  adventurous: 'adventure',
  playful: 'joy',
  suspenseful: 'mystery'
}

const DELIVERY_BY_MOOD: Record<SceneMood, { rate: number; pitch: number; volume: number }> = {
  reflection: { rate: -0.045, pitch: -0.015, volume: 0.94 },
  mystery: { rate: -0.03, pitch: -0.02, volume: 0.98 },
  adventure: { rate: 0.022, pitch: 0, volume: 1 },
  tension: { rate: -0.02, pitch: -0.015, volume: 0.98 },
  joy: { rate: 0.02, pitch: 0.008, volume: 1.02 },
  sorrow: { rate: -0.035, pitch: -0.012, volume: 0.9 },
  nature: { rate: -0.01, pitch: 0, volume: 0.98 },
  romance: { rate: -0.01, pitch: 0.004, volume: 0.97 }
}

const SOUND_BY_MOOD: Record<SceneMood, AmbientSound> = {
  reflection: 'wind',
  mystery: 'mystery',
  adventure: 'wind',
  tension: 'mystery',
  joy: 'wind',
  sorrow: 'rain',
  nature: 'wind',
  romance: 'wind'
}

export function normalizeSceneMood(value: unknown): SceneMood | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return SCENE_MOODS.includes(normalized as SceneMood) ? normalized as SceneMood : null
}

export function sceneMoodFromNarrationStyle(style?: NarrationStyle): SceneMood {
  return style ? FALLBACK_BY_STYLE[style] : 'reflection'
}

export function parseSceneMood(value: unknown, fallbackStyle?: NarrationStyle): SceneMood {
  return normalizeSceneMood(value) ?? sceneMoodFromNarrationStyle(fallbackStyle)
}

export function sceneMoodDelivery(mood?: unknown): { rate: number; pitch: number; volume: number } {
  const normalized = normalizeSceneMood(mood)
  return normalized ? DELIVERY_BY_MOOD[normalized] : { rate: 0, pitch: 0, volume: 1 }
}

export function sceneMoodSoundscape(mood?: unknown): AmbientSound | null {
  const normalized = normalizeSceneMood(mood)
  return normalized ? SOUND_BY_MOOD[normalized] : null
}

export const SCENE_MOOD_AI_INSTRUCTION =
  'For every narrated scene or turn, return sceneMood from exactly: reflection, mystery, adventure, tension, joy, sorrow, nature, romance.'
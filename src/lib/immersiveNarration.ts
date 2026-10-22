import { NARRATION_PRESETS, type NarrationStyle } from './narration'
import type { AmbientSound } from './storyAmbience'

export type NarrationContext = { progress?: number; ending?: boolean; sceneKey?: string }
export type Soundscape = AmbientSound | 'auto'
export type ImmersivePreferences = { expressive: boolean; soundscape: Soundscape; voiceVolume: number; ambientVolume: number }
export const IMMERSIVE_PREFERENCES_KEY = 'muse.narration.immersive.v1'
export const DEFAULT_IMMERSIVE_PREFERENCES: ImmersivePreferences = {
  expressive: true, soundscape: 'auto', voiceVolume: 0.9, ambientVolume: 0.12
}
export const SOUNDSCAPES: Soundscape[] = ['auto', 'none', 'rain', 'wind', 'water', 'crowd']

export function parseImmersivePreferences(raw: string | null): { preferences: ImmersivePreferences; invalid: boolean } {
  const preferences = { ...DEFAULT_IMMERSIVE_PREFERENCES }
  if (raw === null) return { preferences, invalid: false }
  let value: unknown
  try { value = JSON.parse(raw) } catch { return { preferences, invalid: true } }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { preferences, invalid: true }
  const data = value as Record<string, unknown>
  if (data.version !== 1) return { preferences, invalid: true }
  let invalid = false
  if (data.expressive !== undefined) {
    if (typeof data.expressive === 'boolean') preferences.expressive = data.expressive
    else invalid = true
  }
  if (data.soundscape !== undefined) {
    if (SOUNDSCAPES.includes(data.soundscape as Soundscape)) preferences.soundscape = data.soundscape as Soundscape
    else invalid = true
  }
  for (const [key, max] of [['voiceVolume', 1], ['ambientVolume', 0.3]] as const) {
    if (data[key] !== undefined) {
      const number = data[key]
      if (typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= max) preferences[key] = number
      else invalid = true
    }
  }
  return { preferences, invalid }
}

export function storySoundscape(text: string, selection: Soundscape): AmbientSound {
  if (selection !== 'auto') return selection
  // Match only the text being narrated, never a private brief or future scene.
  const visible = text.toLowerCase()
  if (/\b(rain(?:ing|fall|drops)?|drizzle|pioggia|regen)\b/.test(visible)) return 'rain'
  if (/\b(ocean|sea|waves?|river|stream|mare|onde|fiume|meer|wellen|fluss)\b/.test(visible)) return 'water'
  if (/\b(wind|breeze|vento|brezza|brise)\b/.test(visible)) return 'wind'
  if (/\b(crowd|crowded|bustling|cafe|caf\u00e9|marketplace|folla|mercato|menschenmenge|marktplatz)\b/.test(visible)) return 'crowd'
  if (/\b(forest|woods|garden|mountain|meadow|outdoors|leaves|trees|wald|garten|berge|bosco|foresta|giardino)\b/.test(visible)) return 'wind'
  return 'none'
}

const clamp = (number: number, min: number, max: number) => Math.min(max, Math.max(min, number))
export function narrativeDelivery(text: string, style: NarrationStyle, context: NarrationContext, preferences: ImmersivePreferences) {
  const preset = NARRATION_PRESETS[style]
  if (!preferences.expressive) return { rate: preset.rate, pitch: preset.pitch, volume: preferences.voiceVolume }
  const progress = Number.isFinite(context.progress) ? clamp(context.progress!, 0, 1) : 0
  const question = /[?？]\s*$/.test(text)
  const quiet = /\b(whisper(?:ed|s|ing)?|quiet(?:ly)?|softly|sussurra|leise)\b/i.test(text)
  const movement = /\b(rush(?:ed|es|ing)?|run(?:ning)?|race[ds]?|hurry|corre|rennen)\b/i.test(text)
  const ending = Boolean(context.ending)
  const build = style === 'adventurous' || style === 'playful' ? progress * 0.04
    : style === 'suspenseful' ? -progress * 0.035 : 0
  return {
    rate: clamp(preset.rate + build + (movement ? 0.035 : 0) - (quiet ? 0.045 : 0) - (ending ? 0.055 : 0), 0.86, 1.12),
    pitch: clamp(1 + (question ? 0.035 : 0) + (style === 'playful' ? 0.02 : 0) - (quiet || ending ? 0.02 : 0), 0.96, 1.06),
    volume: preferences.voiceVolume * (quiet ? 0.82 : ending ? 0.94 : 1)
  }
}

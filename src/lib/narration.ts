export const NARRATION_STYLES = ['calm', 'warm', 'curious', 'adventurous', 'playful', 'suspenseful'] as const
export type NarrationStyle = typeof NARRATION_STYLES[number]
export type NarrationMetadata = { narrationStyle?: NarrationStyle; narrationLanguage?: string }
export type VoiceInfo = { name: string; lang: string; voiceURI: string; localService?: boolean; default?: boolean }

export const NARRATION_PRESETS: Record<NarrationStyle, { rate: number; pitch: number; voices: string[]; description: string }> = {
  calm: { rate: 0.95, pitch: 1, voices: ['zira', 'katja', 'elsa'], description: 'Quiet and unhurried, with a natural voice.' },
  warm: { rate: 0.98, pitch: 1, voices: ['zira', 'hedda', 'elsa'], description: 'Gentle and welcoming.' },
  curious: { rate: 1, pitch: 1, voices: ['mark', 'katja', 'cosimo'], description: 'Thoughtful and conversational.' },
  adventurous: { rate: 1.05, pitch: 1, voices: ['david', 'stefan', 'michael', 'cosimo'], description: 'Energetic, with a natural voice.' },
  playful: { rate: 1.04, pitch: 1, voices: ['zira', 'hedda', 'elsa'], description: 'Light and lively.' },
  suspenseful: { rate: 0.97, pitch: 1, voices: ['david', 'stefan', 'michael', 'cosimo'], description: 'Measured and thoughtful, without frightening effects.' }
}

export function validateNarrationLanguage(value: unknown): string {
  if (typeof value !== 'string' || value.length > 35 || !/^[a-zA-Z]{2,3}(?:-[a-zA-Z]{4})?(?:-(?:[a-zA-Z]{2}|\d{3}))?$/.test(value)) {
    throw new Error('Narration language must be a valid bounded language tag, such as en-US.')
  }
  try { return Intl.getCanonicalLocales(value)[0] } catch {
    throw new Error('Narration language must be a valid language tag.')
  }
}

export function parseNarrationMetadata(value: Record<string, unknown>, required = false): NarrationMetadata {
  const hasStyle = value.narrationStyle !== undefined
  const hasLanguage = value.narrationLanguage !== undefined
  if (!hasStyle && !hasLanguage && !required) return {}
  if (!NARRATION_STYLES.includes(value.narrationStyle as NarrationStyle)) {
    throw new Error('AI narrationStyle must be calm, warm, curious, adventurous, playful, or suspenseful.')
  }
  return { narrationStyle: value.narrationStyle as NarrationStyle, narrationLanguage: validateNarrationLanguage(value.narrationLanguage) }
}

export const NARRATION_AI_INSTRUCTION = 'Choose narrationStyle from exactly: calm, warm, curious, adventurous, playful, suspenseful. Return narrationStyle and narrationLanguage (a language tag such as en-US, de-DE, or it-IT matching the actual story text) in the same JSON response. Do not return any style reason or other narration metadata.'

export function legacyNarrationStyle(mood?: string): NarrationStyle {
  return mood === 'adventure' ? 'adventurous' : mood === 'relaxed' ? 'calm' : mood === 'hopeful' ? 'warm' : 'curious'
}

export function voiceKey(voice: VoiceInfo): string { return `${voice.voiceURI}|${voice.lang}|${voice.name}` }

export function selectNarrationVoice<T extends VoiceInfo>(voices: T[], language: string, _style: NarrationStyle, selectedKey = ''): T | undefined {
  const tag = language.toLowerCase()
  const base = tag.split('-')[0]
  const matching = voices.filter((voice) => voice.lang.toLowerCase().split(/[-_]/)[0] === base)
  const manual = matching.find((voice) => voiceKey(voice) === selectedKey)
  if (manual) return manual
  // Keep the speaker stable across story styles; mood changes must not select an ominous voice.
  const exact = matching.filter((voice) => voice.lang.toLowerCase().replace('_', '-') === tag)
  const pool = exact.length ? exact : matching
  return [...pool].sort((a, b) => {
    const score = (voice: T) => {
      const preference = NARRATION_PRESETS.warm.voices.findIndex((name) => new RegExp(`\\b${name}\\b`, 'i').test(voice.name))
      const natural = /\b(natural|neural|enhanced|premium)\b/i.test(voice.name)
      return (natural ? 1000 : 0) + (preference >= 0 ? 200 - preference * 20 : 0) + (voice.localService ? 20 : 0) + (voice.default ? 0 : 1)
    }
    // Name/URI tie-breaks keep the fallback deterministic regardless of getVoices() ordering.
    return score(b) - score(a) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || (a.voiceURI < b.voiceURI ? -1 : a.voiceURI > b.voiceURI ? 1 : 0)
  })[0]
}

export function voiceKeyName(key: string): string { return key.split('|').slice(2).join('|') || key }

export const NARRATION_PREFERENCES_KEY = 'muse.narration.preferences.v1'
export const NARRATION_PREFERENCES_VERSION = 1
export type NarrationPreferences = { style: NarrationStyle | 'auto'; language: string; voice: string }
export const DEFAULT_NARRATION_PREFERENCES: NarrationPreferences = { style: 'auto', language: '', voice: '' }

export function normalizeNarrationLanguagePreference(value: unknown): string {
  if (value === '') return ''
  return validateNarrationLanguage(typeof value === 'string' ? value.replace(/_/g, '-') : value)
}

export function isValidVoicePreference(value: unknown): value is string {
  return typeof value === 'string' && (value === '' || (value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value) && value.split('|').length >= 3))
}

/** Absent storage or fields are valid defaults; present-but-invalid data is flagged and ignored field by field. */
export function parseNarrationPreferences(raw: string | null | undefined): { preferences: NarrationPreferences; invalid: boolean } {
  const preferences = { ...DEFAULT_NARRATION_PREFERENCES }
  if (raw === null || raw === undefined) return { preferences, invalid: false }
  let data: unknown
  try { data = JSON.parse(raw) } catch { return { preferences, invalid: true } }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { preferences, invalid: true }
  const value = data as Record<string, unknown>
  if (value.version !== NARRATION_PREFERENCES_VERSION) return { preferences, invalid: true }
  let invalid = false
  if (value.style !== undefined) {
    if (value.style === 'auto' || NARRATION_STYLES.includes(value.style as NarrationStyle)) preferences.style = value.style as NarrationPreferences['style']
    else invalid = true
  }
  if (value.language !== undefined) {
    try { preferences.language = normalizeNarrationLanguagePreference(value.language) } catch { invalid = true }
  }
  if (value.voice !== undefined) {
    if (isValidVoicePreference(value.voice)) preferences.voice = value.voice
    else invalid = true
  }
  return { preferences, invalid }
}

export function serializeNarrationPreferences(preferences: NarrationPreferences): string {
  return JSON.stringify({ version: NARRATION_PREFERENCES_VERSION, style: preferences.style, language: preferences.language, voice: preferences.voice })
}

export function narrationChunks(text: string, limit = 220): string[] {
  const sentences = text.trim().match(/[^.!?。！？]+[.!?。！？]*\s*|[.!?。！？]+/g) || []
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/)
    for (const word of words) {
      for (let start = 0; start < word.length; start += limit) {
        const part = word.slice(start, start + limit)
        if (current.length + part.length + 1 > limit && current) { chunks.push(current); current = '' }
        current = current ? `${current} ${part}` : part
      }
    }
    if (current) { chunks.push(current); current = '' }
  }
  return chunks
}

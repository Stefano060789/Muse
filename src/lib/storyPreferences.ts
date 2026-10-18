import { STORY_LANGUAGES, type StoryLanguageCode } from './storyLanguage'
import { readDraft, writeDraft } from './browserDrafts'

export const STORY_PREFERENCES_KEY = 'muse-preferences'
export type StoryPreferences = { language: StoryLanguageCode; duration: number }
export const DEFAULT_STORY_PREFERENCES: StoryPreferences = { language: 'en-US', duration: 10 }

export function isStoryPreferences(value: unknown): value is StoryPreferences {
  if (!value || typeof value !== 'object') return false
  const settings = value as Record<string, unknown>
  return STORY_LANGUAGES.some(item => item.code === settings.language) && [5, 10, 15, 20].includes(Number(settings.duration)) && typeof settings.duration === 'number'
}

export function loadStoryPreferences(): StoryPreferences {
  return readDraft(STORY_PREFERENCES_KEY, isStoryPreferences) || { ...DEFAULT_STORY_PREFERENCES }
}

export function saveStoryPreferences(value: StoryPreferences): void {
  if (!isStoryPreferences(value)) throw new Error('Choose a supported language and story duration.')
  writeDraft(STORY_PREFERENCES_KEY, value)
}

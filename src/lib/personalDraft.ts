import type { StoryChoiceMode } from './freeformStory'
import type { PersonalStoryMood } from './story'
import type { StoryRomance } from './storyRomance'
import { isStoryPreferences, type StoryPreferences } from './storyPreferences'

export const PERSONAL_DRAFT_KEY = 'muse-personal-creation-draft'
export type PersonalDraft = StoryPreferences & {
  need: string; mood: PersonalStoryMood; choiceMode: StoryChoiceMode
  romance?: StoryRomance; useProfile: boolean; profileDraft: string; step: number
}
export function isPersonalDraft(value: unknown): value is PersonalDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  if (!isStoryPreferences(value)) return false
  return typeof draft.need === 'string' && draft.need.length <= 1000 &&
    typeof draft.mood === 'string' && ['adventure', 'relaxed', 'curious', 'hopeful'].includes(draft.mood) &&
    typeof draft.choiceMode === 'string' && ['free', 'suggested'].includes(draft.choiceMode) &&
    (draft.romance === undefined || draft.romance === 'sweet' || draft.romance === 'spicy') &&
    typeof draft.useProfile === 'boolean' && typeof draft.profileDraft === 'string' && draft.profileDraft.length <= 4000 &&
    Number.isInteger(draft.step) && Number(draft.step) >= 0 && Number(draft.step) <= 2
}
export type ResponseDraft = { revision: number; text: string }
export function isResponseDraft(value: unknown): value is ResponseDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return Number.isInteger(draft.revision) && Number(draft.revision) >= 0 && typeof draft.text === 'string' && draft.text.length <= 800
}
export const responseDraftKey = (id: string) => `muse-personal-answer:${id}`

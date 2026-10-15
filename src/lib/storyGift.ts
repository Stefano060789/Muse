import type { SharedStoryBrief } from './sharedStory'
import { STORY_LANGUAGES } from './storyLanguage'

export const GIFT_OCCASIONS = [
  { id: 'birthday', label: 'Birthday', question: 'What makes them special?', placeholder: 'A favourite memory, their little quirks, or something you admire...', idea: 'A birthday mystery inspired by the personal touches below.', goal: 'Follow the clues to discover a birthday surprise.' },
  { id: 'anniversary', label: 'Our memories', question: 'Which memory should inspire this?', placeholder: 'Where you met, a memorable day, or a place that means something to you...', idea: 'A gentle anniversary mystery through a shared memory described below.', goal: 'Follow the memories to discover a personal surprise.' },
  { id: 'surprise', label: 'A surprise', question: 'What kind of adventure will lead to it?', placeholder: 'A treasure hunt, a mysterious invitation, a favourite place... Keep the exact answer in Secret answer.', idea: 'A playful treasure hunt leading to a surprise, without naming the surprise itself.', goal: 'Follow the clues to find the hidden surprise.' },
  { id: 'just-because', label: 'Just because', question: 'What would make them smile?', placeholder: 'An inside joke, a favourite place, or something you appreciate about them...', idea: 'A warm, personal mystery inspired by the details below.', goal: 'Discover a thoughtful message hidden at the end of the trail.' }
] as const

export type GiftOccasion = typeof GIFT_OCCASIONS[number]['id']
export const GIFT_DRAFT_KEY = 'muse-shared-gift-draft'
export type GiftDraft = { version: 1; brief: SharedStoryBrief; assistanceHintsText: string; alternativeAnswersText: string; savedAt: string }
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function draftStorage(): DraftStorage {
  if (typeof window === 'undefined') throw new Error('Drafts are available only in your browser.')
  return window.localStorage
}

export function parseGiftDraft(value: unknown): GiftDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('This draft could not be read. Discard it to start again.')
  const input = value as Record<string, unknown>
  if (input.version !== 1 || !input.brief || typeof input.brief !== 'object' || Array.isArray(input.brief)) throw new Error('This draft version is not supported.')
  const source = input.brief as Record<string, unknown>
  const limits = { creatorName: 80, recipientName: 80, narration: 600, setting: 3000, recipientHints: 1500, goal: 600, solution: 200, message: 2000 } as const
  const text = (value: unknown, max: number): string => {
    if (typeof value !== 'string' || value.length > max) throw new Error('This draft contains invalid text. Discard it to start again.')
    return value
  }
  const fields = Object.fromEntries(Object.entries(limits).map(([key, max]) => [key, text(source[key], max)])) as Pick<SharedStoryBrief, keyof typeof limits>
  if (![5, 10, 15, 20].includes(Number(source.durationMinutes))) throw new Error('This draft has an invalid duration.')
  const brief: SharedStoryBrief = { ...fields, durationMinutes: Number(source.durationMinutes) }
  if (source.language !== undefined) {
    const language = STORY_LANGUAGES.find(item => item.code === source.language)
    if (!language) throw new Error('This draft has an unsupported story language.')
    brief.language = language.code
  }
  if (source.unlockPolicy !== undefined) {
    if (source.unlockPolicy !== 'solve' && source.unlockPolicy !== 'allow-skip') throw new Error('This draft has an invalid reveal option.')
    brief.unlockPolicy = source.unlockPolicy
  }
  if (source.adventure !== undefined) {
    const adventure = source.adventure as Record<string, unknown>
    if (!adventure || typeof adventure !== 'object' || Array.isArray(adventure) || !Number.isInteger(adventure.actionBudget) || Number(adventure.actionBudget) < 1 || Number(adventure.actionBudget) > 1000 || (adventure.choiceMode !== undefined && !['free', 'suggested'].includes(String(adventure.choiceMode)))) throw new Error('This draft has an invalid interaction option.')
    brief.adventure = { actionBudget: Number(adventure.actionBudget), choiceMode: adventure.choiceMode === 'suggested' ? 'suggested' : 'free' }
  }
  if (source.gift !== undefined) {
    const gift = source.gift as Record<string, unknown>
    const occasion = GIFT_OCCASIONS.find(item => item.id === gift?.occasion)?.id
    if (!occasion || typeof gift.allowReply !== 'boolean') throw new Error('This draft has invalid gift options.')
    brief.gift = { occasion, dedication: text(gift.dedication, 240), allowReply: gift.allowReply }
  }
  const savedAt = text(input.savedAt, 100)
  if (!Number.isFinite(Date.parse(savedAt))) throw new Error('This draft has an invalid date.')
  return { version: 1, brief, assistanceHintsText: text(input.assistanceHintsText, 1806), alternativeAnswersText: text(input.alternativeAnswersText, 1010), savedAt }
}

export function loadGiftDraft(store: DraftStorage = draftStorage()): GiftDraft | null {
  const value = store.getItem(GIFT_DRAFT_KEY)
  if (!value) return null
  if (value.length > 20000) throw new Error('This saved draft is too large. Discard it to start again.')
  try { return parseGiftDraft(JSON.parse(value)) } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Your saved draft could not be read.')
  }
}

export function saveGiftDraft(draft: GiftDraft, store: DraftStorage = draftStorage()): void {
  store.setItem(GIFT_DRAFT_KEY, JSON.stringify(parseGiftDraft(draft)))
}

export function removeGiftDraft(store: DraftStorage = draftStorage()): void {
  store.removeItem(GIFT_DRAFT_KEY)
}

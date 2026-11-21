import { normalizeSceneMood, type SceneMood } from './sceneMood'
import type { PersonalStory, PersonalStoryMood } from './story'

export const JOURNEY_REEL_MAX_SCENES = 8
export const JOURNEY_REEL_CHOICE_LIMIT = 120

export type JourneyReelDraftCard = {
  id: string
  sceneIndex: number
  sceneNumber: number
  title: string
  mood: SceneMood
  choiceText: string
  responseKind: 'choice' | 'free' | 'none'
  hidden: boolean
}

export type JourneyReelRenderCard = JourneyReelDraftCard & { choiceLine: string | null }

export type JourneyReelDraft = {
  cards: JourneyReelDraftCard[]
  defaultShowChoices: boolean
  primaryMood: SceneMood
}

export type JourneyReelTiming = {
  titleSeconds: number
  sceneSeconds: number
  endingSeconds: number
  totalSeconds: number
}

const MOOD_FALLBACK: Record<PersonalStoryMood, SceneMood> = {
  adventure: 'adventure',
  relaxed: 'reflection',
  curious: 'mystery',
  hopeful: 'joy'
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

export function truncateGraphemes(value: string, limit: number): string {
  if (limit < 2) return ''
  const collapsed = value.replace(/\s+/g, ' ').trim()
  const units = Array.from(collapsed)
  if (units.length <= limit) return collapsed
  return `${units.slice(0, limit - 1).join('').trimEnd()}…`
}

export function evenlySampleIndices(total: number, maxItems: number): number[] {
  if (total <= 0 || maxItems <= 0) return []
  if (total <= maxItems) return Array.from({ length: total }, (_, index) => index)
  const result: number[] = []
  let previous = -1
  for (let slot = 0; slot < maxItems; slot++) {
    const remainingSlots = maxItems - slot - 1
    const minIndex = previous + 1
    const maxIndex = total - 1 - remainingSlots
    const ideal = Math.round(slot * (total - 1) / (maxItems - 1))
    const index = Math.min(maxIndex, Math.max(minIndex, ideal))
    result.push(index)
    previous = index
  }
  return result
}

export function journeyResponseKind(response: string, choices: readonly string[] = []): JourneyReelDraftCard['responseKind'] {
  const answer = response.trim()
  if (!answer) return 'none'
  const match = normalized(answer)
  return choices.some(choice => normalized(choice) === match) ? 'choice' : 'free'
}

export function planJourneyReelDraft(story: Pick<PersonalStory, 'mood' | 'scenes' | 'responses' | 'currentStep'>): JourneyReelDraft {
  const visitedCount = Math.max(1, Math.min(story.scenes.length, Math.max(story.responses.length, story.currentStep + 1)))
  const visited = story.scenes.slice(0, visitedCount)
  const selected = evenlySampleIndices(visited.length, JOURNEY_REEL_MAX_SCENES)
  const cards = selected.map(sceneIndex => {
    const scene = visited[sceneIndex]
    const response = story.responses[sceneIndex] ?? ''
    const kind = journeyResponseKind(response, scene.choices)
    return {
      id: `scene-${sceneIndex + 1}`,
      sceneIndex,
      sceneNumber: sceneIndex + 1,
      title: truncateGraphemes(scene.title || `Scene ${sceneIndex + 1}`, 84),
      mood: normalizeSceneMood(scene.sceneMood) ?? MOOD_FALLBACK[story.mood],
      choiceText: truncateGraphemes(response, JOURNEY_REEL_CHOICE_LIMIT),
      responseKind: kind,
      hidden: false
    }
  })
  const hasFreeTextResponse = visited.some((scene, index) => {
    const response = story.responses[index] ?? ''
    return Boolean(response.trim()) && journeyResponseKind(response, scene.choices) === 'free'
  })
  return {
    cards,
    defaultShowChoices: !hasFreeTextResponse,
    primaryMood: cards[0]?.mood ?? MOOD_FALLBACK[story.mood]
  }
}

export function applyJourneyReelVisibility(cards: readonly JourneyReelDraftCard[], showChoices: boolean): JourneyReelRenderCard[] {
  return cards.filter(card => !card.hidden).map(card => ({
    ...card,
    choiceLine: showChoices && card.choiceText ? card.choiceText : null
  }))
}

export function journeyReelConsentRequired(cards: readonly JourneyReelDraftCard[], showChoices: boolean): boolean {
  return showChoices && cards.some(card => !card.hidden && Boolean(card.choiceText))
}

export function journeyReelTiming(sceneCardCount: number): JourneyReelTiming {
  const titleSeconds = 3
  const endingSeconds = 3
  const count = Math.max(1, sceneCardCount)
  let sceneSeconds = 2.4
  let totalSeconds = titleSeconds + endingSeconds + sceneSeconds * count
  if (totalSeconds < 15) sceneSeconds = (15 - titleSeconds - endingSeconds) / count
  if (totalSeconds > 30) sceneSeconds = (30 - titleSeconds - endingSeconds) / count
  sceneSeconds = Math.max(1.7, sceneSeconds)
  totalSeconds = titleSeconds + endingSeconds + sceneSeconds * count
  return { titleSeconds, sceneSeconds, endingSeconds, totalSeconds }
}

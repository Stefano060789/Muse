import { SharedStoryError } from './sharedStory'
import { storyProviderConfig, generateStoryJson } from './storyProvider'
import { parseStoryLanguage, type StoryLanguageCode } from './storyLanguage'
import type { PersonalStoryMood } from './story'
import { normalizeStoryReelMoments, parseStoryReelTheme, sanitizeStoryReelSummary, type StoryReelMoment, type StoryReelSource, type StoryReelTheme } from './storyReelLogic'
import { reserveStoryReelPlanAttempt } from './storyReelLimits'
import { PROVIDER_CONSENT_VERSION } from './providerConsent'

const moods: PersonalStoryMood[] = ['adventure', 'relaxed', 'curious', 'hopeful']

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SharedStoryError('Story reel details must be an object.', 400)
  }
  return value as Record<string, unknown>
}

function text(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new SharedStoryError(`${name} must be between 1 and ${max} characters.`, 400)
  }
  return value.trim()
}

function mood(value: unknown): PersonalStoryMood {
  if (!moods.includes(value as PersonalStoryMood)) throw new SharedStoryError('Choose a valid story mood for the reel.', 400)
  return value as PersonalStoryMood
}

function language(value: unknown): StoryLanguageCode {
  const parsed = parseStoryLanguage(value)
  if (!parsed) throw new SharedStoryError('Choose a language for the story reel.', 400)
  return parsed
}

function parseScene(value: unknown, index: number) {
  const input = object(value)
  return {
    index,
    title: text(input.title ?? `Scene ${index + 1}`, 'Scene title', 160),
    summary: sanitizeStoryReelSummary(text(input.body ?? '', 'Scene text', 2500)),
    ...(typeof input.sceneMood === 'string' ? { sceneMood: input.sceneMood } : {})
  }
}

export function parseStoryReelPlanInput(value: unknown): StoryReelSource {
  const input = object(value)
  const scenesInput = Array.isArray(input.scenes) ? input.scenes : []
  const currentStep = Number.isInteger(input.currentStep) ? Number(input.currentStep) : scenesInput.length - 1
  if (!scenesInput.length) throw new SharedStoryError('Save at least one scene before creating a reel.', 409)
  const maxScene = Math.min(scenesInput.length - 1, Math.max(0, currentStep))
  const scenes = scenesInput.slice(0, maxScene + 1).map(parseScene)
  if (!scenes.length) throw new SharedStoryError('Save at least one scene before creating a reel.', 409)
  return {
    title: text(input.title, 'Story title', 160),
    mood: mood(input.mood),
    language: language(input.language),
    scenes
  }
}

const STORY_REEL_PLAN_SYSTEM = [
  'You plan a short social reel inspired by a finished story.',
  'Select 4 to 6 spoiler-light moments from the supplied scenes in chronological order.',
  'Each moment must return scene (1-based index), caption, and prompt.',
  'Caption: one line, 12-88 characters, no line breaks.',
  'Prompt: 40-220 characters for an original illustration, vertical 9:16, no text overlay.',
  'Never include user answers, personal facts, memories, profile details, emails, phone numbers, or account identifiers.',
  'Never name living people or copyrighted characters/franchises.',
  'Use only details in the supplied scenes. Keep it cinematic, gentle, and share-safe.',
  'Return valid JSON only: {"moments":[{"scene":1,"caption":"...","prompt":"..."}]}'
].join('\n')

export async function generateStoryReelPlan(source: StoryReelSource, accountId: string): Promise<{
  moments: StoryReelMoment[]
  source: 'ai' | 'fallback'
}> {
  try {
    storyProviderConfig()
  } catch {
    return { moments: normalizeStoryReelMoments(source, []), source: 'fallback' }
  }
  try {
    await reserveStoryReelPlanAttempt(accountId)
    const generated = object(await generateStoryJson(STORY_REEL_PLAN_SYSTEM, {
      title: source.title,
      mood: source.mood,
      language: source.language,
      scenes: source.scenes.map(scene => ({
        scene: scene.index + 1,
        title: scene.title,
        summary: scene.summary,
        ...(scene.sceneMood ? { sceneMood: scene.sceneMood } : {})
      }))
    }, 900))
    return { moments: normalizeStoryReelMoments(source, generated.moments), source: 'ai' }
  } catch {
    return { moments: normalizeStoryReelMoments(source, []), source: 'fallback' }
  }
}

export const STORY_REEL_IMAGE_CONSENT_VERSION = PROVIDER_CONSENT_VERSION

function parseMoment(value: unknown): StoryReelMoment {
  const input = object(value)
  const scene = Number(input.scene)
  if (!Number.isInteger(scene) || scene < 0 || scene > 99) throw new SharedStoryError('Story reel moment scene index is invalid.', 400)
  return {
    id: text(input.id ?? `moment-${scene + 1}`, 'Story reel moment ID', 60),
    scene,
    caption: text(input.caption, 'Story reel caption', 120),
    prompt: text(input.prompt, 'Story reel prompt', 280),
    motif: 'light'
  }
}

export function parseStoryReelImageRequest(value: unknown): {
  theme: StoryReelTheme
  moments: StoryReelMoment[]
} {
  const input = object(value)
  if (input.approved !== true || input.consentVersion !== STORY_REEL_IMAGE_CONSENT_VERSION) {
    throw new SharedStoryError('Review and approve sending reel prompts to the image provider before rendering.', 403)
  }
  if (!Array.isArray(input.moments) || input.moments.length < 1 || input.moments.length > 6) {
    throw new SharedStoryError('Select 1 to 6 story-reel moments to render.', 400)
  }
  return {
    theme: parseStoryReelTheme(input.theme),
    moments: input.moments.map(parseMoment)
  }
}

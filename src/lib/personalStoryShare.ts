import { SharedStoryError } from './sharedStory'
import { generateStoryJson } from './storyProvider'
import { parseStoryLanguage, type StoryLanguageCode } from './storyLanguage'
import type { PersonalStoryMood } from './story'

const moods: PersonalStoryMood[] = ['adventure', 'relaxed', 'curious', 'hopeful']

export type PersonalStoryShareInput = {
  title: string
  mood: PersonalStoryMood
  language: StoryLanguageCode
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SharedStoryError('Share teaser details must be an object.')
  }
  return value as Record<string, unknown>
}

export function parsePersonalStoryShareInput(value: unknown): PersonalStoryShareInput {
  const input = object(value)
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 160) {
    throw new SharedStoryError('Story title must be between 1 and 160 characters.')
  }
  if (!moods.includes(input.mood as PersonalStoryMood)) {
    throw new SharedStoryError('Choose a valid personal story mood.')
  }
  const language = parseStoryLanguage(input.language)
  if (!language) throw new SharedStoryError('Choose a language for the share teaser.')
  return { title: input.title.trim(), mood: input.mood as PersonalStoryMood, language }
}

export async function generatePersonalStoryShareTeaser(input: PersonalStoryShareInput): Promise<string> {
  const system = [
    'You write a short public-facing teaser for a personal story.',
    'The teaser must be spoiler-free, warm, intriguing, and suitable for a social-media post.',
    'Use only the supplied title and broad mood. Do not invent plot events, character names, personal facts, answers, or story details.',
    'Do not reveal scenes, choices, responses, memories, or endings. Do not quote or imitate a copyrighted work or living author.',
    'Write one or two concise sentences, 20 to 40 words, in the requested language.',
    'Return valid JSON only in the exact shape {"teaser":"..."}.'
  ].join('\n')
  const result = object(await generateStoryJson(system, input, 120))
  if (typeof result.teaser !== 'string') {
    throw new SharedStoryError('The AI provider returned an invalid share teaser.', 502)
  }
  const teaser = result.teaser.trim()
  if (teaser.length < 20 || teaser.length > 320 || /[\r\n]/.test(teaser)) {
    throw new SharedStoryError('The AI provider returned a share teaser outside the allowed length.', 502)
  }
  return teaser
}

import { demoLocalization } from './demoPageLocalization'
import type { StoryLanguageCode } from './storyLanguage'

export const SAMPLE_STORY = demoLocalization('en-US').story

export function sampleStoryForLanguage(language: StoryLanguageCode) {
  return demoLocalization(language).story
}

const answerAliases: Record<StoryLanguageCode, string[]> = {
  'en-US': ['picnic', 'a picnic'],
  'it-IT': ['picnic', 'un picnic', 'picnic all’aperto'],
  'es-ES': ['picnic', 'un picnic', 'pícnic', 'un pícnic'],
  'zh-CN': ['野餐', 'picnic'],
  'hi-IN': ['पिकनिक', 'पिकनिक पर जाना', 'picnic'],
  'uk-UA': ['пікнік', 'на пікнік', 'picnic'],
  'ar-SA': ['نزهة', 'نزهة في الخارج', 'picnic']
}

export function sampleAnswerMatches(value: string, language: StoryLanguageCode = 'en-US'): boolean {
  const normalized = value.trim().toLocaleLowerCase(language)
    .replace(/^[\s"'“”‘’«»]+|[\s"'“”‘’«»]+$/gu, '')
    .replace(/[.!?؟。！？]+$/gu, '')
    .trim()
  return answerAliases[language].some(answer => answer.toLocaleLowerCase(language) === normalized)
}

import { demoLocalization } from './demoPageLocalization'
import type { StoryLanguageCode } from './storyLanguage'

export const SAMPLE_STORY = demoLocalization('en-US').story

export function sampleStoryForLanguage(language: StoryLanguageCode) {
  return demoLocalization(language).story
}

import { NARRATION_STYLES, type NarrationStyle } from './narration'
import type { SharedStoryContent, SharedStoryScene } from './sharedStory'
import { STORY_LANGUAGES, type StoryLanguageCode } from './storyLanguage'

export type SharedStoryTranslation = {
  language: StoryLanguageCode
  content: SharedStoryContent
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function text(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
}

export function parseSharedStoryTranslation(
  value: unknown,
  language: StoryLanguageCode,
  sourceScenes?: SharedStoryScene[]
): SharedStoryTranslation {
  if (!isRecord(value) || Object.keys(value).sort().join() !== 'content,language' ||
    value.language !== language || !STORY_LANGUAGES.some(item => item.code === value.language) ||
    !isRecord(value.content)) {
    throw new Error('The translated story response is invalid.')
  }
  const content = value.content
  if (Object.keys(content).sort().join() !== 'description,narrationLanguage,narrationStyle,scenes,title' ||
    !text(content.title, 160) || !text(content.description, 500) ||
    !NARRATION_STYLES.includes(content.narrationStyle as NarrationStyle) ||
    content.narrationLanguage !== language || !Array.isArray(content.scenes) ||
    content.scenes.length < 1 || content.scenes.length > 9 ||
    (sourceScenes && sourceScenes.length !== content.scenes.length)) {
    throw new Error('The translated story response is invalid.')
  }
  const scenes = content.scenes.map((item, index) => {
    const source = sourceScenes?.[index]
    const keys = source?.choices ? 'body,choices,clue,title' : 'body,clue,title'
    if (!isRecord(item) || Object.keys(item).sort().join() !== keys ||
      !text(item.title, 160) || !text(item.body, 6000) || !text(item.clue, 600)) {
      throw new Error('The translated story response is invalid.')
    }
    let choices: string[] | undefined
    if (source?.choices || item.choices !== undefined) {
      if (!Array.isArray(item.choices) || item.choices.length < 3 || item.choices.length > 5 ||
        (source?.choices && item.choices.length !== source.choices.length) ||
        item.choices.some(choice => !text(choice, 160))) {
        throw new Error('The translated story response is invalid.')
      }
      choices = item.choices as string[]
    }
    return {
      title: item.title, body: item.body, clue: item.clue,
      ...(choices ? { choices } : {})
    }
  })
  return {
    language,
    content: {
      title: content.title, description: content.description, narrationStyle: content.narrationStyle as NarrationStyle,
      narrationLanguage: language, scenes
    }
  }
}

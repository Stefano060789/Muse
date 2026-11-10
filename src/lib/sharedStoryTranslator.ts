import { normalizeSharedAnswer, SharedStoryError, type SharedStoryBrief, type SharedStoryContent } from './sharedStory'
import { generateStoryJson } from './storyProvider'
import { parseSharedStoryTranslation } from './sharedStoryTranslation'
import { storyLanguageInstruction, type StoryLanguageCode } from './storyLanguage'

export async function translateSharedStory(
  brief: SharedStoryBrief,
  content: SharedStoryContent,
  language: StoryLanguageCode
) {
  const system = [
    'Translate the supplied public interactive story into the requested language. This is a faithful translation, not a rewrite or a new story.',
    'Keep every clue, choice, event, relationship, object, proper name, and safe action faithful to the source. Do not add a clue or reveal a secret.',
    'The source includes only public story scenes. Never invent or ask for a secret answer, alternate answer, private hint, dedication or final message.',
    'Keep narrationStyle unchanged. Return JSON only with exactly {"content":{"title":"...","description":"...","narrationStyle":"warm","narrationLanguage":"...","scenes":[{"title":"...","body":"...","clue":"...","choices":["..."]}]}}.',
    'Each translated scene must preserve whether choices are present and keep the same number of choices. Preserve their meaning and safe intent.',
    storyLanguageInstruction(language)
  ].join('\n')
  const input = {
    sourceLanguage: brief.language ?? content.narrationLanguage ?? 'en-US',
    targetLanguage: language,
    content: {
      title: content.title,
      description: content.description,
      narrationStyle: content.narrationStyle ?? 'warm',
      scenes: content.scenes.map(scene => ({
        title: scene.title, body: scene.body, clue: scene.clue,
        ...(scene.choices ? { choices: scene.choices } : {})
      }))
    }
  }
  const result = await generateStoryJson(system, input, 9000)
  try {
    const translation = parseSharedStoryTranslation({ language, content: result }, language, content.scenes)
    const publicText = normalizeSharedAnswer([
      translation.content.title, translation.content.description,
      ...translation.content.scenes.flatMap(scene => [scene.title, scene.body, scene.clue, ...(scene.choices ?? [])])
    ].join(' '))
    const privateAnswers = [
      brief.solution, brief.message, ...(brief.alternativeAnswers ?? []),
      ...(brief.assistanceHints ?? []), ...(brief.endingChoices ?? [])
    ].map(normalizeSharedAnswer).filter(Boolean)
    if (privateAnswers.some(answer => (` ${publicText} `).includes(` ${answer} `))) {
      throw new SharedStoryError('The translated story failed privacy validation. No translation was returned.', 502)
    }
    return translation
  } catch (error) {
    if (error instanceof SharedStoryError) throw error
    throw new SharedStoryError('The translated story failed validation. Its AI attempt may count; no translated text was returned.', 502)
  }
}

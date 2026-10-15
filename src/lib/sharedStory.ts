import { parseNarrationMetadata, type NarrationMetadata } from './narration'
import type { SharedMediaKind, SharedMediaMime, SharedVoiceSummary } from './sharedStoryMedia'
import { parseStoryChoiceMode, parseSuggestedChoices, type StoryChoiceMode } from './freeformStory'
import { assertStoryNarrationLanguage, parseStoryLanguage, recipientCopy, storyWordCount, type StoryLanguageCode } from './storyLanguage'

export const SHARED_STORY_DURATIONS = [5, 10, 15, 20] as const

export type SharedStoryGift = {
  occasion: 'birthday' | 'anniversary' | 'surprise' | 'just-because'
  dedication: string
  allowReply: boolean
}

export type SharedStoryBrief = {
  language?: StoryLanguageCode
  creatorName: string
  recipientName: string
  narration: string
  setting: string
  recipientHints: string
  goal: string
  solution: string
  message: string
  durationMinutes: number
  assistanceHints?: string[]
  alternativeAnswers?: string[]
  unlockPolicy?: 'solve' | 'allow-skip'
  adventure?: { actionBudget: number; choiceMode?: StoryChoiceMode }
  gift?: SharedStoryGift
}

export type SharedStoryScene = { title: string; body: string; clue: string; choices?: string[] }

export function parseSharedSceneChoices(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  return parseSuggestedChoices(value)
}
export type SharedStoryContent = NarrationMetadata & { title: string; description: string; scenes: SharedStoryScene[] }
export type SharedStoryPlayer = NarrationMetadata & {
  language?: StoryLanguageCode
  title: string
  description: string
  creatorName: string
  recipientName: string
  durationMinutes: number
  scene: SharedStoryScene
  sceneIndex: number
  sceneCount: number
  discoveries: SharedStoryScene[]
  solved: boolean
  skipped: boolean
  canSkip: boolean
  revealedHints: string[]
  hintsRemaining: number
  feedback?: string
  message?: string
  gift?: SharedStoryGift
  media?: { kind: SharedMediaKind; mime: SharedMediaMime }
  voice?: { mime: 'audio/wav'; size: number }
  adventure?: import('./sharedAdventure').AdventureView
}

export class SharedStoryError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message)
    this.name = 'SharedStoryError'
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SharedStoryError('Story details must be an object.')
  }
  return value as Record<string, unknown>
}

function text(value: unknown, label: string, max: number, optional = false): string {
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.length > max) {
    throw new SharedStoryError(label + ' ' + (optional ? 'must be text' : 'is required') + ' (maximum ' + max + ' characters).')
  }
  return value.trim()
}

export function parseSharedStoryBrief(value: unknown, options: { allowEmptyMessage?: boolean } = {}): SharedStoryBrief {
  const input = record(value)
  let language: StoryLanguageCode | undefined
  try { language = parseStoryLanguage(input.language) } catch (error) {
    throw new SharedStoryError(error instanceof Error ? error.message : 'Invalid story language.')
  }
  if (!SHARED_STORY_DURATIONS.some((duration) => duration === input.durationMinutes)) {
    throw new SharedStoryError('Choose a duration of 5, 10, 15, or 20 minutes.')
  }
  const brief = {
    ...(language ? { language } : {}),
    creatorName: text(input.creatorName, 'Your name', 80),
    recipientName: text(input.recipientName, 'Recipient name', 80),
    narration: text(input.narration, 'Narration style', 600),
    setting: text(input.setting, 'Story idea and setting', 3000),
    recipientHints: text(input.recipientHints, 'Personal hints', 1500, true),
    goal: text(input.goal, 'What the recipient needs to find or solve', 600),
    solution: text(input.solution, 'Secret answer', 200),
    message: options.allowEmptyMessage && typeof input.message === 'string' && !input.message.trim() ? '' : text(input.message, 'Final message', 2000),
    durationMinutes: Number(input.durationMinutes),
    assistanceHints: privateList(input.assistanceHints, 'Assistance hints', 3, 600),
    alternativeAnswers: privateList(input.alternativeAnswers, 'Approved alternative answers', 5, 200),
    ...(input.unlockPolicy === undefined ? {} : { unlockPolicy: parseUnlockPolicy(input.unlockPolicy) }),
    ...(input.adventure === undefined ? {} : { adventure: parseAdventureBudget(input.adventure) }),
    ...(input.gift === undefined ? {} : { gift: parseGift(input.gift) })
  }

  function parseUnlockPolicy(value: unknown): 'solve' | 'allow-skip' {
    if (value !== 'solve' && value !== 'allow-skip') throw new SharedStoryError('Choose Solve to unlock or Allow a skip.')
    return value
  }

  function parseAdventureBudget(value: unknown): { actionBudget: number; choiceMode?: StoryChoiceMode } {
    const input = record(value)
    if (Object.keys(input).some(key => key !== 'actionBudget' && key !== 'choiceMode') || !Number.isInteger(input.actionBudget) || Number(input.actionBudget) < 1 || Number(input.actionBudget) > 1000) {
      throw new SharedStoryError('Choose an explicit adventure AI action budget from 1 to 1000.')
    }
    const choiceMode = parseStoryChoiceMode(input.choiceMode)
    return { actionBudget: Number(input.actionBudget), choiceMode }
  }
  function parseGift(value: unknown): SharedStoryGift {
    const input = record(value)
    if (Object.keys(input).some(key => !['occasion', 'dedication', 'allowReply'].includes(key)) ||
        !['occasion', 'dedication', 'allowReply'].every(key => Object.prototype.hasOwnProperty.call(input, key))) {
      throw new SharedStoryError('Gift details must include only an occasion, dedication, and reply preference.')
    }
    if (!['birthday', 'anniversary', 'surprise', 'just-because'].includes(String(input.occasion))) {
      throw new SharedStoryError('Choose a supported gift occasion.')
    }
    if (typeof input.dedication !== 'string' || input.dedication.length > 240) {
      throw new SharedStoryError('Gift dedication must be text of at most 240 characters.')
    }
    if (typeof input.allowReply !== 'boolean') {
      throw new SharedStoryError('Choose whether the recipient may reply.')
    }
    return {
      occasion: input.occasion as SharedStoryGift['occasion'],
      dedication: input.dedication.trim(),
      allowReply: input.allowReply
    }
  }
  if (!normalizeSharedAnswer(brief.solution) || (brief.message && !normalizeSharedAnswer(brief.message))) {
    throw new SharedStoryError('The answer and message must contain letters or numbers.')
  }
  if (brief.gift?.dedication) {
    const dedication = normalizeSharedAnswer(brief.gift.dedication)
    const privateValues = [brief.solution, brief.message, ...brief.alternativeAnswers, ...brief.assistanceHints]
      .map(normalizeSharedAnswer).filter(Boolean)
    if (privateValues.some(value => (` ${dedication} `).includes(` ${value} `))) {
      throw new SharedStoryError('Gift dedication must not reveal the secret answer, final message, or private hints.')
    }
  }
  if (brief.alternativeAnswers.some(answer => !normalizeSharedAnswer(answer))) {
    throw new SharedStoryError('Approved alternative answers must contain letters or numbers.')
  }
  return brief
}

function privateList(value: unknown, label: string, count: number, max: number): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > count) {
    throw new SharedStoryError(label + ' must be a list of at most ' + count + ' entries.')
  }
  return value.map(entry => text(entry, label, max))
}

export function normalizeSharedAnswer(answer: string): string {
  return answer.toLowerCase().replace(new RegExp('[^\\p{L}\\p{N}]+', 'gu'), ' ').trim()
}

export function sceneCountForDuration(minutes: number): number {
  return minutes <= 5 ? 3 : minutes <= 10 ? 5 : minutes <= 15 ? 7 : 9
}

export function parseGeneratedStory(value: unknown, brief: SharedStoryBrief): SharedStoryContent {
  const input = record(value)
  const title = text(input.title, 'Generated title', 160)
  const description = text(input.description, 'Generated description', 500)
  const count = sceneCountForDuration(brief.durationMinutes)
  if (!Array.isArray(input.scenes) || input.scenes.length !== count) {
    throw new SharedStoryError('The AI must return exactly ' + count + ' scenes.', 502)
  }
  const scenes = input.scenes.map((value) => {
    const scene = record(value)
    return {
      title: text(scene.title, 'Scene title', 160),
      body: text(scene.body, 'Scene narration', 6000),
      clue: text(scene.clue, 'Scene clue', 600),
      ...(scene.choices === undefined ? {} : { choices: parseSharedSceneChoices(scene.choices) })
    }
  })
  if (brief.adventure?.choiceMode === 'suggested' && !scenes[0].choices) {
    throw new SharedStoryError('Suggested-choice stories need 3 to 5 opening actions.', 502)
  }
  const publicText = normalizeSharedAnswer([title, description, ...scenes.flatMap((scene) => [scene.title, scene.body, scene.clue, ...(scene.choices || [])])].join(' '))
  const solutions = [brief.solution, ...(brief.alternativeAnswers ?? [])].map(normalizeSharedAnswer)
  const message = normalizeSharedAnswer(brief.message)
  if (solutions.some(solution => !solution) || (brief.message && !message)) throw new SharedStoryError('The answer and message must contain letters or numbers.')
  const privateHints = (brief.assistanceHints ?? []).map(normalizeSharedAnswer).filter(Boolean)
  if ([...solutions, message, ...privateHints].filter(Boolean).some(secret => (' ' + publicText + ' ').includes(' ' + secret + ' '))) {
    throw new SharedStoryError('The generated narration exposed the answer or final message. Try generating again.', 502)
  }
  const words = storyWordCount(scenes.map((scene) => scene.body + ' ' + scene.clue).join(' '), brief.language)
  if (words < brief.durationMinutes * 60 || words > brief.durationMinutes * 110) {
    throw new SharedStoryError('The AI returned a story outside the requested narration length. Try generating again.', 502)
  }
  try {
    assertStoryNarrationLanguage(input.narrationLanguage, brief.language)
    return { title, description, scenes, ...parseNarrationMetadata(input, true) }
  } catch (error) {
    throw new SharedStoryError(error instanceof Error ? error.message : 'Invalid AI narration metadata.', 502)
  }
}

export function sharedStoryPlayerView(
  brief: SharedStoryBrief,
  content: SharedStoryContent,
  state: { current_scene: number; solved: boolean; skipped?: boolean; revealed_hints?: number },
  feedback?: string,
  media?: { kind: SharedMediaKind; mime: SharedMediaMime } | null,
  voice?: SharedVoiceSummary | null
): SharedStoryPlayer {
  const sceneIndex = Math.max(0, Math.min(state.current_scene, content.scenes.length - 1))
  const hints = brief.assistanceHints ?? []
  const revealed = Math.max(0, Math.min(state.revealed_hints ?? 0, hints.length))
  const copy = brief.language ? recipientCopy(brief.language) : undefined
  const feedbackLabels: Record<string, string> | undefined = copy ? {
    'You solved it.': copy.feedbackSolved,
    'Not quite. Explore the clues and try again.': copy.feedbackWrong,
    'Revealed without solving': copy.feedbackSkipped
  } : undefined
  const localizedFeedback = feedback && feedbackLabels && Object.prototype.hasOwnProperty.call(feedbackLabels, feedback)
    ? feedbackLabels[feedback] : feedback
  return {
    ...(brief.language ? { language: brief.language } : {}),
    title: content.title,
    description: content.description,
    ...parseNarrationMetadata(content),
    creatorName: brief.creatorName,
    recipientName: brief.recipientName,
    durationMinutes: brief.durationMinutes,
    scene: content.scenes[sceneIndex],
    sceneIndex,
    sceneCount: content.scenes.length,
    discoveries: content.scenes.slice(0, sceneIndex),
    solved: state.solved,
    skipped: state.skipped === true,
    canSkip: brief.unlockPolicy === 'allow-skip' && !state.solved && !state.skipped,
    revealedHints: hints.slice(0, revealed),
    hintsRemaining: hints.length - revealed,
    ...(localizedFeedback ? { feedback: localizedFeedback } : {}),
    ...(brief.gift ? { gift: brief.gift } : {}),
    ...((state.solved || state.skipped) && brief.message ? { message: brief.message } : {}),
    ...((state.solved || state.skipped) && media ? { media: { kind: media.kind, mime: media.mime } } : {}),
    ...((state.solved || state.skipped) && voice ? { voice: { mime: voice.mime, size: voice.size } } : {})
  }
}

import { parseNarrationMetadata, type NarrationMetadata } from './narration'
import type { SharedMediaKind, SharedMediaMime, SharedVoiceSummary } from './sharedStoryMedia'
import { parseStoryChoiceMode, parseSuggestedChoices, SuggestedChoicesError, type StoryChoiceMode } from './freeformStory'
import { assertStoryNarrationLanguage, parseStoryLanguage, recipientCopy, storyWordCount, type StoryLanguageCode } from './storyLanguage'
import { parseStoryRomance, type StoryRomance } from './storyRomance'
import { SharedStoryError } from './sharedStoryError'

export { SharedStoryError } from './sharedStoryError'

export const SHARED_STORY_DURATIONS = [5, 10, 15, 20] as const

export type SharedStoryGift = {
  occasion: 'birthday' | 'anniversary' | 'surprise' | 'just-because'
  dedication: string
  allowReply: boolean
}

export type SharedStoryAnswerType = 'clue' | 'word' | 'phrase' | 'action'
export type SharedStoryPuzzleDifficulty = 'gentle' | 'easy' | 'balanced' | 'challenging' | 'expert'
export type SharedStoryEndingMode = 'answer' | 'choice' | 'automatic'
export type SharedStoryBrief = {
  romance?: StoryRomance
  language?: StoryLanguageCode
  creatorName: string
  recipientName: string
  participants?: 'recipient' | 'together'
  narration: string
  setting: string
  recipientHints: string
  goal: string
  solution: string
  endingMode?: SharedStoryEndingMode
  endingChoices?: string[]
  puzzleDifficulty?: SharedStoryPuzzleDifficulty
  answerType?: SharedStoryAnswerType
  answerInstruction?: string
  message: string
  durationMinutes: number
  assistanceHints?: string[]
  alternativeAnswers?: string[]
  unlockPolicy?: 'solve' | 'allow-skip'
  adventure?: { actionBudget: number; choiceMode?: StoryChoiceMode; turnTaking?: boolean; cooperative?: boolean }
  gift?: SharedStoryGift
}

export type SharedStoryScene = { title: string; body: string; clue: string; choices?: string[] }

export function parseSharedSceneChoices(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  return parseSuggestedChoices(value)
}
export type SharedStoryContent = NarrationMetadata & { title: string; description: string; scenes: SharedStoryScene[] }
export type SharedStoryPlayer = NarrationMetadata & {
  romance?: StoryRomance
  language?: StoryLanguageCode
  participants?: 'recipient' | 'together'
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
  answerType: SharedStoryAnswerType
  endingMode: SharedStoryEndingMode
  endingChoices?: string[]
  answerInstruction?: string
  media?: { kind: SharedMediaKind; mime: SharedMediaMime }
  voice?: { mime: 'audio/wav'; size: number }
  adventure?: import('./sharedAdventure').AdventureView
  cooperative?: import('./storyRepository').CooperativeView
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
  let romance: StoryRomance | undefined
  try { romance = parseStoryRomance(input.romance) } catch (error) {
    throw new SharedStoryError(error instanceof Error ? error.message : 'Invalid romance mode.')
  }
  let language: StoryLanguageCode | undefined
  try { language = parseStoryLanguage(input.language) } catch (error) {
    throw new SharedStoryError(error instanceof Error ? error.message : 'Invalid story language.')
  }
  if (!SHARED_STORY_DURATIONS.some((duration) => duration === input.durationMinutes)) {
    throw new SharedStoryError('Choose a duration of 5, 10, 15, or 20 minutes.')
  }
  const answerType = input.answerType === undefined ? 'phrase' : input.answerType
  if (!['clue', 'word', 'phrase', 'action'].includes(String(answerType))) {
    throw new SharedStoryError('Choose whether the recipient should find a clue, say a word or phrase, or describe an action.')
  }
  const answerInstruction = input.answerInstruction === undefined ? '' : text(input.answerInstruction, 'Final-scene instruction', 500, true)
  if (input.participants !== undefined && input.participants !== 'recipient' && input.participants !== 'together') {
    throw new SharedStoryError('Choose a supported participant option.')
  }
  const endingMode = input.endingMode ?? 'answer'
  if (!['answer', 'choice', 'automatic'].includes(String(endingMode)) || input.endingMode === null) {
    throw new SharedStoryError('Choose a supported ending mode.')
  }
  let endingChoices: string[] | undefined
  if (endingMode === 'choice') {
    if (!Array.isArray(input.endingChoices) || input.endingChoices.length < 3 || input.endingChoices.length > 5) {
      throw new SharedStoryError('Write 3 to 5 distinct final options.')
    }
    endingChoices = input.endingChoices.map(value => text(value, 'Final option', 160))
    const normalized = endingChoices.map(normalizeSharedAnswer)
    if (normalized.some(value => !value) || new Set(normalized).size !== normalized.length) {
      throw new SharedStoryError('Write 3 to 5 distinct final options.')
    }
  } else if (input.endingChoices !== undefined && (!Array.isArray(input.endingChoices) || input.endingChoices.length > 0)) {
    throw new SharedStoryError('Final options are only available for a final-choice ending.')
  }
  const puzzleDifficulty = input.puzzleDifficulty === undefined ? 'balanced' : input.puzzleDifficulty
  if (!['gentle', 'easy', 'balanced', 'challenging', 'expert'].includes(String(puzzleDifficulty))) {
    throw new SharedStoryError('Choose a supported puzzle difficulty.')
  }
  const brief = {
    ...(romance ? { romance } : {}),
    ...(language ? { language } : {}),
    creatorName: text(input.creatorName, 'Your name', 80),
    recipientName: text(input.recipientName, 'Recipient name', 80),
    ...(input.participants === undefined ? {} : { participants: input.participants as 'recipient' | 'together' }),
    narration: text(input.narration, 'Narration style', 600),
    setting: text(input.setting, 'Story idea and setting', 3000),
    recipientHints: text(input.recipientHints, 'Personal hints', 1500, true),
    goal: text(input.goal, 'What the recipient needs to find or solve', 600),
    solution: text(input.solution === undefined && endingMode !== 'answer' ? '' : input.solution, 'Secret answer', 200, endingMode !== 'answer'),
    ...(input.endingMode === undefined ? {} : { endingMode: endingMode as SharedStoryEndingMode }),
    ...(endingChoices ? { endingChoices } : {}),
    puzzleDifficulty: puzzleDifficulty as SharedStoryPuzzleDifficulty,
    answerType: answerType as SharedStoryAnswerType,
    ...(answerInstruction ? { answerInstruction } : {}),
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

  function parseAdventureBudget(value: unknown): { actionBudget: number; choiceMode?: StoryChoiceMode; turnTaking?: boolean; cooperative?: boolean } {
    const input = record(value)
    if (Object.keys(input).some(key => !['actionBudget', 'choiceMode', 'turnTaking', 'cooperative'].includes(key)) ||
        !Number.isInteger(input.actionBudget) || Number(input.actionBudget) < 1 || Number(input.actionBudget) > 1000 ||
        (input.turnTaking !== undefined && typeof input.turnTaking !== 'boolean') ||
        (input.cooperative !== undefined && typeof input.cooperative !== 'boolean')) {
      throw new SharedStoryError('Choose an explicit adventure AI action budget from 1 to 1000.')
    }
    const choiceMode = parseStoryChoiceMode(input.choiceMode)
    return {
      actionBudget: Number(input.actionBudget), choiceMode,
      ...(input.turnTaking === true ? { turnTaking: true } : {}),
      ...(input.cooperative === true ? { cooperative: true } : {})
    }
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
  if ((endingMode === 'answer' && !normalizeSharedAnswer(brief.solution)) || (brief.message && !normalizeSharedAnswer(brief.message))) {
    throw new SharedStoryError('The answer and message must contain letters or numbers.')
  }
  const acceptedAnswers = [brief.solution, ...brief.alternativeAnswers]
  if (endingMode === 'answer' && brief.answerType === 'word' && acceptedAnswers.some(answer => normalizeSharedAnswer(answer).split(' ').length !== 1)) {
    throw new SharedStoryError('A word answer and each accepted alternative must contain one word. Choose phrase for longer answers.')
  }
  if (brief.answerInstruction) {
    const instruction = normalizeSharedAnswer(brief.answerInstruction)
    const privateValues = [brief.solution, brief.message, ...brief.alternativeAnswers, ...brief.assistanceHints, ...(brief.endingChoices ?? [])]
      .map(normalizeSharedAnswer).filter(Boolean)
    if (privateValues.some(value => (` ${instruction} `).includes(` ${value} `))) {
      throw new SharedStoryError('The final-scene instruction must not reveal the answer, message, or private hints.')
    }
  }
  if (brief.gift?.dedication) {
    const dedication = normalizeSharedAnswer(brief.gift.dedication)
    const privateValues = [brief.solution, brief.message, ...brief.alternativeAnswers, ...brief.assistanceHints, ...(brief.endingChoices ?? [])]
      .map(normalizeSharedAnswer).filter(Boolean)
    if (privateValues.some(value => (` ${dedication} `).includes(` ${value} `))) {
      throw new SharedStoryError('Gift dedication must not reveal the secret answer, final message, or private hints.')
    }
  }
  if (brief.alternativeAnswers.some(answer => !normalizeSharedAnswer(answer))) {
    throw new SharedStoryError('Approved alternative answers must contain letters or numbers.')
  }
  const secrets = [brief.solution, brief.message, ...brief.alternativeAnswers, ...brief.assistanceHints].map(normalizeSharedAnswer).filter(Boolean)
  if (endingChoices?.some(choice => secrets.some(secret => (` ${normalizeSharedAnswer(choice)} `).includes(` ${secret} `)))) {
    throw new SharedStoryError('Final options must not reveal the answer, message, or private hints.')
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
  const scenes = input.scenes.map((value, index) => {
    const scene = record(value)
    const unusedChoices = index === count - 1 || (brief.adventure && brief.adventure.choiceMode !== 'suggested')
    const emptyUnusedChoices = unusedChoices && (scene.choices === null || (Array.isArray(scene.choices) && scene.choices.length === 0))
    return {
      title: text(scene.title, 'Scene title', 160),
      body: text(scene.body, 'Scene narration', 6000),
      clue: text(scene.clue, 'Scene clue', 600),
      ...(scene.choices === undefined || emptyUnusedChoices ? {} : { choices: parseSharedSceneChoices(scene.choices) })
    }
  })
  if (brief.adventure?.choiceMode === 'suggested' && scenes.slice(0, -1).some(scene => !scene.choices)) {
    throw new SuggestedChoicesError('Suggested-choice stories need 3 to 5 distinct actions on every non-final prepared scene.')
  }
  const publicText = normalizeSharedAnswer([title, description, ...scenes.flatMap((scene) => [scene.title, scene.body, scene.clue, ...(scene.choices || [])])].join(' '))
  const solutions = [brief.solution, ...(brief.alternativeAnswers ?? [])].map(normalizeSharedAnswer).filter(Boolean)
  const message = normalizeSharedAnswer(brief.message)
  if (((brief.endingMode ?? 'answer') === 'answer' && !normalizeSharedAnswer(brief.solution)) || (brief.message && !message)) throw new SharedStoryError('The answer and message must contain letters or numbers.')
  const privateHints = (brief.assistanceHints ?? []).map(normalizeSharedAnswer).filter(Boolean)
  if ([...solutions, message, ...privateHints, ...(brief.endingChoices ?? []).map(normalizeSharedAnswer)].filter(Boolean).some(secret => (' ' + publicText + ' ').includes(' ' + secret + ' '))) {
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
  const atEnding = sceneIndex === content.scenes.length - 1
  const completed = atEnding && (state.solved || state.skipped === true)
  const endingMode = brief.endingMode ?? 'answer'
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
    ...(brief.participants ? { participants: brief.participants } : {}),
    ...(brief.romance ? { romance: parseStoryRomance(brief.romance) } : {}),
    title: content.title,
    description: content.description,
    ...parseNarrationMetadata(content),
    creatorName: brief.creatorName,
    recipientName: brief.recipientName,
    durationMinutes: brief.durationMinutes,
    scene: atEnding && brief.adventure?.choiceMode === 'suggested'
      ? { ...content.scenes[sceneIndex], choices: undefined } : content.scenes[sceneIndex],
    sceneIndex,
    sceneCount: content.scenes.length,
    discoveries: content.scenes.slice(0, sceneIndex),
    solved: atEnding && state.solved,
    skipped: atEnding && state.skipped === true,
    canSkip: atEnding && endingMode === 'answer' && brief.unlockPolicy === 'allow-skip' && !completed,
    revealedHints: hints.slice(0, revealed),
    hintsRemaining: hints.length - revealed,
    ...(localizedFeedback ? { feedback: localizedFeedback } : {}),
    ...(brief.gift ? { gift: brief.gift } : {}),
    answerType: brief.answerType ?? 'phrase',
    endingMode,
    ...(atEnding && endingMode === 'choice' ? { endingChoices: brief.endingChoices } : {}),
    ...(endingMode === 'answer' && brief.answerInstruction && atEnding ? { answerInstruction: brief.answerInstruction } : {}),
    ...(completed && brief.message ? { message: brief.message } : {}),
    ...(completed && media ? { media: { kind: media.kind, mime: media.mime } } : {}),
    ...(completed && voice ? { voice: { mime: voice.mime, size: voice.size } } : {})
  }
}

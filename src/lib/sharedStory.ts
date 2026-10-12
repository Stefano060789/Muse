import { parseNarrationMetadata, type NarrationMetadata } from './narration'

export const SHARED_STORY_DURATIONS = [5, 10, 15, 20] as const

export type SharedStoryBrief = {
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
  adventure?: { actionBudget: number }
}

export type SharedStoryScene = { title: string; body: string; clue: string; choices?: string[] }

export function parseSharedSceneChoices(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length !== 3) throw new SharedStoryError('Scene actions must contain exactly three choices.', 502)
  const choices = value.map(choice => text(choice, 'Scene action', 160))
  if (new Set(choices.map(choice => choice.toLowerCase())).size !== choices.length) throw new SharedStoryError('Scene actions must be distinct.', 502)
  return choices
}
export type SharedStoryContent = NarrationMetadata & { title: string; description: string; scenes: SharedStoryScene[] }
export type SharedStoryPlayer = NarrationMetadata & {
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
  revealedHints: string[]
  hintsRemaining: number
  feedback?: string
  message?: string
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
    throw new SharedStoryError(`${label} ${optional ? 'must be text' : 'is required'} (maximum ${max} characters).`)
  }
  return value.trim()
}

export function parseSharedStoryBrief(value: unknown): SharedStoryBrief {
  const input = record(value)
  if (!SHARED_STORY_DURATIONS.some((duration) => duration === input.durationMinutes)) {
    throw new SharedStoryError('Choose a duration of 5, 10, 15, or 20 minutes.')
  }
  const brief = {
    creatorName: text(input.creatorName, 'Your name', 80),
    recipientName: text(input.recipientName, 'Recipient name', 80),
    narration: text(input.narration, 'Narration style', 600),
    setting: text(input.setting, 'Story idea and setting', 3000),
    recipientHints: text(input.recipientHints, 'Personal hints', 1500, true),
    goal: text(input.goal, 'What the recipient needs to find or solve', 600),
    solution: text(input.solution, 'Secret answer', 200),
    message: text(input.message, 'Final message', 2000),
    durationMinutes: Number(input.durationMinutes),
    assistanceHints: privateList(input.assistanceHints, 'Assistance hints', 3, 600),
    alternativeAnswers: privateList(input.alternativeAnswers, 'Approved alternative answers', 5, 200),
    ...(input.adventure === undefined ? {} : { adventure: parseAdventureBudget(input.adventure) })
  }

  function parseAdventureBudget(value: unknown): { actionBudget: number } {
    const input = record(value)
    if (Object.keys(input).some(key => key !== 'actionBudget') || !Number.isInteger(input.actionBudget) || Number(input.actionBudget) < 1 || Number(input.actionBudget) > 1000) {
      throw new SharedStoryError('Choose an explicit adventure AI action budget from 1 to 1000.')
    }
    return { actionBudget: Number(input.actionBudget) }
  }
  if (!normalizeSharedAnswer(brief.solution) || !normalizeSharedAnswer(brief.message)) {
    throw new SharedStoryError('The answer and message must contain letters or numbers.')
  }
  if (brief.alternativeAnswers.some(answer => !normalizeSharedAnswer(answer))) {
    throw new SharedStoryError('Approved alternative answers must contain letters or numbers.')
  }
  return brief
}

function privateList(value: unknown, label: string, count: number, max: number): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > count) {
    throw new SharedStoryError(`${label} must be a list of at most ${count} entries.`)
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
    throw new SharedStoryError(`The AI must return exactly ${count} scenes.`, 502)
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
  const publicText = normalizeSharedAnswer([title, description, ...scenes.flatMap((scene) => [scene.title, scene.body, scene.clue, ...(scene.choices || [])])].join(' '))
  const solutions = [brief.solution, ...(brief.alternativeAnswers ?? [])].map(normalizeSharedAnswer)
  const message = normalizeSharedAnswer(brief.message)
  if (solutions.some(solution => !solution) || !message) throw new SharedStoryError('The answer and message must contain letters or numbers.')
  const privateHints = (brief.assistanceHints ?? []).map(normalizeSharedAnswer).filter(Boolean)
  if ([...solutions, message, ...privateHints].some(secret => ` ${publicText} `.includes(` ${secret} `))) {
    throw new SharedStoryError('The generated narration exposed the answer or final message. Try generating again.', 502)
  }
  const words = scenes.map((scene) => `${scene.body} ${scene.clue}`).join(' ').split(/\s+/).length
  if (words < brief.durationMinutes * 60 || words > brief.durationMinutes * 110) {
    throw new SharedStoryError('The AI returned a story outside the requested narration length. Try generating again.', 502)
  }
  try {
    return { title, description, scenes, ...parseNarrationMetadata(input, true) }
  } catch (error) {
    throw new SharedStoryError(error instanceof Error ? error.message : 'Invalid AI narration metadata.', 502)
  }
}

export function sharedStoryPlayerView(
  brief: SharedStoryBrief,
  content: SharedStoryContent,
  state: { current_scene: number; solved: boolean; revealed_hints?: number },
  feedback?: string
): SharedStoryPlayer {
  const sceneIndex = Math.max(0, Math.min(state.current_scene, content.scenes.length - 1))
  const hints = brief.assistanceHints ?? []
  const revealed = Math.max(0, Math.min(state.revealed_hints ?? 0, hints.length))
  return {
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
    revealedHints: hints.slice(0, revealed),
    hintsRemaining: hints.length - revealed,
    ...(feedback ? { feedback } : {}),
    ...(state.solved ? { message: brief.message } : {})
  }
}

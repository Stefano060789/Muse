import { createHash } from 'crypto'
import type { PersonalStory, PersonalStoryMood } from './story'
import { SharedStoryError } from './sharedStory'
import { parsePersonalStoryRequest } from './personalStoryGenerator'
import { generateStoryJson } from './storyProvider'
import { NARRATION_AI_INSTRUCTION, parseNarrationMetadata, type NarrationMetadata } from './narration'
import { assertStoryNarrationLanguage, recipientCopy, storyLanguageInstruction, storyWordCount, type StoryLanguageCode } from './storyLanguage'
import { romanceInstruction, type StoryRomance } from './storyRomance'
import {
  boundedStoryList, boundedStoryText, exactObject, invalidFreeform, parseFreeformState,
  parseStoryChoiceMode, parseSuggestedChoices, validatePlayerChoiceSelection, freeformSystemPrompt,
  type FreeformState, type StoryChoiceMode
} from './freeformStory'

export const JOURNEY_TURNS = { 5: 3, 10: 6, 15: 9, 20: 12 } as const
export type JourneyDuration = keyof typeof JOURNEY_TURNS
export type JourneyInput = {
  romance?: StoryRomance
  language?: StoryLanguageCode
  mood: PersonalStoryMood
  need: string
  profileKeypoints: string[]
  duration: JourneyDuration
  choiceMode?: StoryChoiceMode
}
export type JourneyTurn = {
  narration: string
  state: FreeformState
  concluded: boolean
  choices?: string[]
}
export type JourneyOpening = NarrationMetadata & {
  title: string
  description: string
  plan: string[]
  turn: JourneyTurn
  choiceMode?: StoryChoiceMode
}
export type JourneyRecord = {
  id: string
  capabilityHash: string
  input: JourneyInput
  createdAt: string
  expiresAt: string | null
  opening: JourneyOpening | null
  used: number
  turn: JourneyTurn | null
  lastAction: string
  scenes: PersonalStory['scenes']
  responses: string[]
  creationStatus: 'pending' | 'done' | 'failed'
}
export type JourneySnapshot = {
  duration: JourneyDuration
  maxTurns: number
  revision: number
  pending: boolean
  status: 'preparing' | 'active' | 'concluded' | 'exhausted' | 'failed'
  state: FreeformState | null
  choiceMode?: StoryChoiceMode
  choices?: string[]
}
export type JourneyResult = { record: JourneyRecord; snapshot: JourneySnapshot; status?: 'reserved' | 'pending' | 'done' | 'failed' }
export type JourneyOperation = {
  operation: 'create' | 'view' | 'reserve' | 'finish'
  id: string
  capabilityHash: string
  accountId: string
  requestId?: string
  fingerprint?: string
  revision?: number
  input?: JourneyInput
  opening?: JourneyOpening
  turn?: JourneyTurn
  text?: string
  failed?: boolean
  cap: number
}
export const journeyHash = (value: string) => createHash('sha256').update(value).digest('hex')
export function journeyIdentifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new SharedStoryError('Provide a valid journey/request ID.')
  return value.toLowerCase()
}
export function journeyCapability(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/i.test(value)) throw new SharedStoryError('Provide the saved journey capability.')
  return value
}
export function parseJourneyInput(body: Record<string, unknown>): JourneyInput {
  if (!Number.isInteger(body.duration) || !(Number(body.duration) in JOURNEY_TURNS)) throw new SharedStoryError('Choose 5, 10, 15 or 20 minutes.')
  const parsed = parsePersonalStoryRequest({ ...body, action: 'create' })
  if (parsed.action !== 'create') throw new SharedStoryError('Invalid journey input.')
  const choiceMode = parseStoryChoiceMode(body.choiceMode)
  return {
    ...(parsed.language ? { language: parsed.language } : {}),
    ...(parsed.romance ? { romance: parsed.romance } : {}),
    mood: parsed.mood,
    need: parsed.need,
    profileKeypoints: parsed.profileKeypoints,
    duration: body.duration as JourneyDuration,
    choiceMode
  }
}
export function parseJourneyAction(body: Record<string, unknown>, authoritativeRecord?: JourneyRecord) {
  const requestId = journeyIdentifier(body.requestId)
  if (!Number.isInteger(body.revision) || Number(body.revision) < 0 || Number(body.revision) > 12) {
    throw new SharedStoryError('Provide the current revision.')
  }
  const mode = authoritativeRecord ? authoritativeRecord.input.choiceMode ?? 'free' : parseStoryChoiceMode(body.choiceMode)
  const availableChoices = authoritativeRecord?.turn?.choices
  // Old revisions are passed to the atomic repository for duplicate replay or
  // stale-state rejection; they can never reserve a fresh paid attempt.
  const replay = authoritativeRecord && body.revision !== authoritativeRecord.used
  const text = validatePlayerChoiceSelection(replay ? 'free' : mode, availableChoices, body)
  return { requestId, revision: Number(body.revision), text, fingerprint: journeyHash(JSON.stringify([text, body.revision])) }
}
export function parseJourneyTurn(value: unknown, concluding: boolean, mode: StoryChoiceMode = 'free', language?: StoryLanguageCode): JourneyTurn {
  const isSuggested = mode === 'suggested' && !concluding
  const keys = isSuggested ? ['narration', 'state', 'concluded', 'choices'] : ['narration', 'state', 'concluded']
  const input = exactObject(value, keys)
  const narration = boundedStoryText(input.narration, 1800)
  const words = storyWordCount(narration, language)
  if (words < 30 || words > 180 || input.concluded !== concluding) throw invalidFreeform()
  const choices = isSuggested ? parseSuggestedChoices(input.choices) : undefined
  return { narration, state: parseFreeformState(input.state), concluded: concluding, ...(choices ? { choices } : {}) }
}
export function parseJourneyOpening(value: unknown, mode: StoryChoiceMode = 'free', language?: StoryLanguageCode): JourneyOpening {
  const input = exactObject(value, ['title', 'description', 'plan', 'turn', 'narrationStyle', 'narrationLanguage'])
  const plan = boundedStoryList(input.plan, 5, 180)
  if (plan.length < 3) throw invalidFreeform()
  try {
    assertStoryNarrationLanguage(input.narrationLanguage, language)
    return {
      title: boundedStoryText(input.title, 160), description: boundedStoryText(input.description, 500), plan,
      ...parseNarrationMetadata(input, true), turn: parseJourneyTurn(input.turn, false, mode, language),
      choiceMode: mode
    }
  } catch { throw invalidFreeform() }
}
export function journeySnapshot(record: JourneyRecord, pending: boolean): JourneySnapshot {
  const maxTurns = JOURNEY_TURNS[record.input.duration]
  const mode = record.input.choiceMode ?? 'free'
  const isFinalOrExhausted = record.turn?.concluded || (record.used >= maxTurns && !pending)
  const choices = mode === 'suggested' && !isFinalOrExhausted && !pending ? record.turn?.choices : undefined
  return {
    duration: record.input.duration, maxTurns, revision: record.used, pending,
    status: record.creationStatus === 'failed' ? 'failed' : record.creationStatus === 'pending' ? 'preparing' :
      record.turn?.concluded ? 'concluded' : record.used >= maxTurns && !pending ? 'exhausted' : 'active',
    state: record.turn?.state ?? null,
    choiceMode: mode,
    ...(choices ? { choices } : {})
  }
}
export function publicJourney(result: JourneyResult, capability: string) {
  const { record, status } = result
  const snapshot = journeySnapshot(record, result.snapshot.pending)
  const story: PersonalStory | null = record.opening ? {
    ...(record.input.language ? { language: record.input.language } : {}),
    ...(record.input.romance ? { romance: record.input.romance } : {}),
    id: record.id, createdAt: record.createdAt, generation: 'ai', title: record.opening.title, description: record.opening.description,
    mood: record.input.mood, need: record.input.need, profileKeypoints: record.input.profileKeypoints,
    narrationStyle: record.opening.narrationStyle, narrationLanguage: record.opening.narrationLanguage,
    scenes: record.input.language ? record.scenes.map((scene, index) => index === 0 ? scene : {
      ...scene,
      title: record.turn?.concluded && index === record.scenes.length - 1
        ? recipientCopy(record.input.language).conclusion
        : recipientCopy(record.input.language).scene(index + 1, record.scenes.length)
    }) : record.scenes,
    currentStep: record.scenes.length - 1, responses: record.responses,
    journey: { ...snapshot, capability }
  } : null
  return { story, snapshot, status }
}
function journeySystem(mode: StoryChoiceMode): string {
  return [
    'You are Muse, an original warm non-therapeutic personal storyteller.', freeformSystemPrompt(mode),
    'The selected mood is authoritative even if the need suggests another mood. Do not infer or replace it.',
    'Adventure favors movement and courage; relaxed favors quiet unpressured exploration; curious favors learning and perspectives; hopeful favors gentle possibilities.',
    'Personalize only from supplied details without inventing biography. This is not a hidden-answer puzzle, secret mystery, or guessing game.',
    'Duration is approximate reading and participation time, never a timer. Weave actions into the prepared flexible arc, relevant to the selected mood.',
    'Write 100-180 words of concrete narration (strict maximum 180 words and 1800 characters). Respect language and narration style.',
    'Return ONLY the exact requested JSON, no extra keys.', NARRATION_AI_INSTRUCTION
  ].join('\n')
}
export async function generateJourneyOpening(input: JourneyInput): Promise<JourneyOpening> {
  const mode = input.choiceMode ?? 'free'
  const system = journeySystem(mode) + '\n' + romanceInstruction(input.romance) + '\n' + storyLanguageInstruction(input.language)
  const choicePrompt = mode === 'suggested'
    ? 'Provide exactly 3 to 5 distinct proposed actions in turn.choices (each at most 160 characters).'
    : 'Leave room for freeform actions without fixed choice menus.'
  const turnJson = mode === 'suggested'
    ? '{"narration":"...","state":{"inventory":[],"discoveries":[],"relationships":[],"progress":"..."},"concluded":false,"choices":["...","...","..."]}'
    : '{"narration":"...","state":{"inventory":[],"discoveries":[],"relationships":[],"progress":"..."},"concluded":false}'
  return parseJourneyOpening(await generateStoryJson(
    system + '\nPrepare 3-5 compact arc points (each at most 180 characters) and the opening in ONE response. ' + choicePrompt + ' Return {"title":"...","description":"...","narrationStyle":"warm","narrationLanguage":"' + (input.language ?? 'en-US') + '","plan":["..."],"turn":' + turnJson + '}. Choose a valid narration style.', input, 1600), mode, input.language)
}
export async function generateJourneyTurn(record: JourneyRecord): Promise<JourneyTurn> {
  if (!record.opening || !record.turn) throw new SharedStoryError('Journey is not ready.', 409)
  const remaining = JOURNEY_TURNS[record.input.duration] - record.used
  const mode = record.input.choiceMode ?? 'free'
  const language = record.input.language
  const system = journeySystem(mode) + '\n' + romanceInstruction(record.input.romance) + '\n' + storyLanguageInstruction(language)
  const isFinal = remaining === 0
  const turnPrompt = isFinal
    ? 'This is the FINAL paid response. Deliver an actual meaningful conclusion resolving the arc and reflecting the latest action, state and consequences. No unresolved required next action or question. Set concluded:true.'
    : ('There are ' + remaining + ' responses left after this one. ' + (remaining <= 2 ? 'Draw threads together toward the ending.' : 'Develop the flexible arc.') + ' Set concluded:false.' + (mode === 'suggested' ? ' Provide exactly 3 to 5 distinct proposed actions in choices (each at most 160 characters).' : ''))
  const turnJson = isFinal
    ? '{"narration":"...","state":{"inventory":[],"discoveries":[],"relationships":[],"progress":"..."},"concluded":true}'
    : mode === 'suggested'
      ? '{"narration":"...","state":{"inventory":[],"discoveries":[],"relationships":[],"progress":"..."},"concluded":false,"choices":["...","...","..."]}'
      : '{"narration":"...","state":{"inventory":[],"discoveries":[],"relationships":[],"progress":"..."},"concluded":false}'
  const generated = await generateStoryJson(
    system + '\n' + turnPrompt + '\nReturn ' + (language ? '{"narrationLanguage":"' + language + '","turn":' + turnJson + '}' : turnJson) + '.',
    {
      ...record.input, title: record.opening.title, plan: record.opening.plan,
      narrationStyle: record.opening.narrationStyle, narrationLanguage: record.opening.narrationLanguage,
      state: record.turn.state, recentNarration: record.turn.narration, action: record.lastAction, responsesRemaining: remaining
    }, 1600)
  try {
    if (language) {
      const envelope = exactObject(generated, ['narrationLanguage', 'turn'])
      assertStoryNarrationLanguage(envelope.narrationLanguage, language)
      return parseJourneyTurn(envelope.turn, isFinal, mode, language)
    }
    return parseJourneyTurn(generated, isFinal, mode)
  } catch (error) {
    throw new SharedStoryError(error instanceof Error ? error.message : 'Invalid journey language response.', 502)
  }
}

import type { PersonalStory } from './story'
import { parseSharedSceneChoices, parseSharedStoryBrief, type SharedStoryBrief, type SharedStoryContent } from './sharedStory'
import { NARRATION_STYLES, validateNarrationLanguage, type NarrationMetadata } from './narration'

export const STORY_LIBRARY_KEY = 'muse-story-library'
const PERSONAL_KEY = 'muse-personal-story'
const SHARED_KEY = 'muse-shared-creator'
export type CreatorStory = { ownerToken: string; playToken?: string; brief: SharedStoryBrief; content: SharedStoryContent; expiresAt: string }
export type LibraryEntry =
  | { kind: 'personal'; id: string; updatedAt: string; story: PersonalStory }
  | { kind: 'shared'; id: string; updatedAt: string; story: CreatorStory }
export type StoryLibrary = { version: 1; entries: LibraryEntry[]; latestPersonal: string | null; latestShared: string | null }
export type LibraryResult = { library: StoryLibrary; error: string | null }
type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function record(value: unknown): Record<string, unknown> {
  if (!object(value)) throw new Error('Expected story details to be an object.')
  return value
}
function text(value: unknown, max = 100000): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid story text.')
  return value
}
function identifier(value: unknown): string {
  const result = text(value, 512)
  if (!result.trim()) throw new Error('Missing story identifier.')
  return result
}
function date(value: unknown): string {
  const result = text(value, 100)
  if (!Number.isFinite(Date.parse(result))) throw new Error('Invalid story date.')
  return result
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Invalid story list.')
  return value
}
function strings(value: unknown): string[] { return list(value).map(item => text(item)) }
function narration(input: Record<string, unknown>): NarrationMetadata {
  const result: NarrationMetadata = {}
  if (input.narrationStyle !== undefined) {
    const style = NARRATION_STYLES.find(style => style === input.narrationStyle)
    if (!style) throw new Error('Invalid narration style.')
    result.narrationStyle = style
  }
  if (input.narrationLanguage !== undefined) result.narrationLanguage = validateNarrationLanguage(input.narrationLanguage)
  return result
}

export function validatePersonalStory(value: unknown): PersonalStory {
  const input = record(value)
  const mood = input.mood
  if (mood !== 'adventure' && mood !== 'relaxed' && mood !== 'curious' && mood !== 'hopeful') throw new Error('Invalid story mood.')
  const scenes = list(input.scenes).map(value => {
    const scene = record(value)
    return { title: text(scene.title), body: text(scene.body), question: text(scene.question), choices: strings(scene.choices) }
  })
  if (!scenes.length || typeof input.currentStep !== 'number' || !Number.isInteger(input.currentStep) || input.currentStep < 0 || input.currentStep >= scenes.length) throw new Error('Invalid story progress.')
  if (input.generation !== undefined && input.generation !== 'ai') throw new Error('Invalid story generation.')
  return {
    id: identifier(input.id), mood, title: text(input.title), description: text(input.description),
    currentStep: input.currentStep, createdAt: date(input.createdAt), responses: strings(input.responses), scenes,
    ...narration(input),
    ...(input.generation === 'ai' ? { generation: 'ai' } : {}),
    ...(input.need !== undefined ? { need: text(input.need) } : {}),
    ...(input.profileKeypoints !== undefined ? { profileKeypoints: strings(input.profileKeypoints) } : {})
  }
}

export function validateCreatorStory(value: unknown): CreatorStory {
  const input = record(value)
  const content = record(input.content)
  const scenes = list(content.scenes).map(value => {
    const scene = record(value)
    return { title: text(scene.title), body: text(scene.body), clue: text(scene.clue), ...(scene.choices === undefined ? {} : { choices: parseSharedSceneChoices(scene.choices) }) }
  })
  if (!scenes.length) throw new Error('Missing shared story scenes.')
  return {
    ownerToken: identifier(input.ownerToken),
    ...(input.playToken !== undefined ? { playToken: identifier(input.playToken) } : {}),
    expiresAt: date(input.expiresAt), brief: parseSharedStoryBrief(input.brief),
    content: { title: text(content.title), description: text(content.description), scenes, ...narration(content) }
  }
}

function empty(): StoryLibrary { return { version: 1, entries: [], latestPersonal: null, latestShared: null } }
export function validateStoryLibrary(value: unknown): StoryLibrary {
  const input = record(value)
  if (input.version !== 1) throw new Error('Unsupported story library version.')
  const entries: LibraryEntry[] = list(input.entries).map(value => {
    const entry = record(value)
    const id = identifier(entry.id)
    const updatedAt = date(entry.updatedAt)
    if (entry.kind === 'personal') {
      const story = validatePersonalStory(entry.story)
      if (id !== story.id) throw new Error('Story identifier does not match.')
      return { kind: 'personal', id, updatedAt, story }
    }
    if (entry.kind === 'shared') {
      const story = validateCreatorStory(entry.story)
      if (id !== story.ownerToken) throw new Error('Story identifier does not match.')
      return { kind: 'shared', id, updatedAt, story }
    }
    throw new Error('Unknown story library entry.')
  })
  const ids = entries.map(entry => `${entry.kind}:${entry.id}`)
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate story library entries.')
  function latest(value: unknown, kind: LibraryEntry['kind']): string | null {
    if (value === null) return null
    const id = identifier(value)
    if (!entries.some(entry => entry.kind === kind && entry.id === id)) throw new Error('Invalid latest story reference.')
    return id
  }
  return { version: 1, entries, latestPersonal: latest(input.latestPersonal, 'personal'), latestShared: latest(input.latestShared, 'shared') }
}

function storage(): BrowserStorage {
  if (typeof window === 'undefined') throw new Error('The story library is available only in your browser.')
  return window.localStorage
}
function read(store: BrowserStorage): StoryLibrary {
  const raw = store.getItem(STORY_LIBRARY_KEY)
  // Once initialized, the library is authoritative; old compatibility keys cannot resurrect removed entries.
  if (raw !== null) return validateStoryLibrary(JSON.parse(raw))
  const library = empty()
  const personal = store.getItem(PERSONAL_KEY)
  const shared = store.getItem(SHARED_KEY)
  if (personal !== null) {
    const story = validatePersonalStory(JSON.parse(personal))
    library.entries.push({ kind: 'personal', id: story.id, updatedAt: story.createdAt, story })
    library.latestPersonal = story.id
  }
  if (shared !== null) {
    const story = validateCreatorStory(JSON.parse(shared))
    library.entries.push({ kind: 'shared', id: story.ownerToken, updatedAt: new Date().toISOString(), story })
    library.latestShared = story.ownerToken
  }
  store.setItem(STORY_LIBRARY_KEY, JSON.stringify(library))
  return library
}
function failure(error: unknown): Error {
  return new Error(`This browser could not read or save the story library. Existing data was not replaced. Check browser storage permissions or space; malformed data needs recovery before saving. ${error instanceof Error ? error.message : ''}`)
}
export function loadStoryLibrary(store?: BrowserStorage): LibraryResult {
  try { return { library: read(store || storage()), error: null } }
  catch (error) { return { library: empty(), error: failure(error).message } }
}
function update(change: (library: StoryLibrary) => void, store?: BrowserStorage): StoryLibrary {
  try {
    const target = store || storage()
    const library = read(target)
    change(library)
    target.setItem(STORY_LIBRARY_KEY, JSON.stringify(validateStoryLibrary(library)))
    return library
  } catch (error) { throw failure(error) }
}
function compatibility(key: string, value: string | null, store?: BrowserStorage) {
  try {
    const target = store || storage()
    if (value === null) target.removeItem(key)
    else target.setItem(key, value)
  } catch {
    throw new Error('Your library change was saved, but this browser could not update the old compatibility copy. Reopen stories from the library.')
  }
}
export function saveLibraryPersonalStory(value: PersonalStory, store?: BrowserStorage): void {
  const story = validatePersonalStory(value)
  update(library => {
    library.entries = library.entries.filter(entry => !(entry.kind === 'personal' && entry.id === story.id))
    library.entries.push({ kind: 'personal', id: story.id, updatedAt: new Date().toISOString(), story })
    library.latestPersonal = story.id
  }, store)
  compatibility(PERSONAL_KEY, JSON.stringify(story), store)
}
export function saveLibraryCreatorStory(value: CreatorStory, store?: BrowserStorage): void {
  const story = validateCreatorStory(value)
  update(library => {
    library.entries = library.entries.filter(entry => !(entry.kind === 'shared' && entry.id === story.ownerToken))
    library.entries.push({ kind: 'shared', id: story.ownerToken, updatedAt: new Date().toISOString(), story })
    library.latestShared = story.ownerToken
  }, store)
  compatibility(SHARED_KEY, JSON.stringify(story), store)
}
export function selectPersonalStory(id: string, store?: BrowserStorage): void {
  const library = update(library => {
    if (!library.entries.some(entry => entry.kind === 'personal' && entry.id === id)) throw new Error('This saved story no longer exists.')
    library.latestPersonal = id
  }, store)
  const entry = library.entries.find(entry => entry.kind === 'personal' && entry.id === id)
  if (entry) compatibility(PERSONAL_KEY, JSON.stringify(entry.story), store)
}
export function removeLibraryEntry(kind: LibraryEntry['kind'], id: string, store?: BrowserStorage): void {
  const library = update(library => {
    library.entries = library.entries.filter(entry => !(entry.kind === kind && entry.id === id))
    const remaining = library.entries.filter(entry => entry.kind === kind).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    if (kind === 'personal' && library.latestPersonal === id) library.latestPersonal = remaining[0]?.id || null
    if (kind === 'shared' && library.latestShared === id) library.latestShared = remaining[0]?.id || null
  }, store)
  const latest = kind === 'personal' ? library.latestPersonal : library.latestShared
  const entry = library.entries.find(entry => entry.kind === kind && entry.id === latest)
  compatibility(kind === 'personal' ? PERSONAL_KEY : SHARED_KEY, entry ? JSON.stringify(entry.story) : null, store)
}
export function latestPersonalStory(result: LibraryResult): PersonalStory | null {
  const entry = result.library.entries.find(entry => entry.kind === 'personal' && entry.id === result.library.latestPersonal)
  return entry?.kind === 'personal' ? entry.story : null
}
export function latestCreatorStory(result: LibraryResult): CreatorStory | null {
  const entry = result.library.entries.find(entry => entry.kind === 'shared' && entry.id === result.library.latestShared)
  return entry?.kind === 'shared' ? entry.story : null
}

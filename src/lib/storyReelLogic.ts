import type { PersonalStoryMood } from './story'
import type { StoryLanguageCode } from './storyLanguage'
import { suggestStoryMotif, type StoryMotif } from './storyShareArtwork'

export const STORY_REEL_THEMES = ['starlight', 'paper', 'dawn'] as const
export type StoryReelTheme = typeof STORY_REEL_THEMES[number]

export type StoryReelSourceScene = {
  index: number
  title: string
  summary: string
  sceneMood?: string
}

export type StoryReelSource = {
  title: string
  mood: PersonalStoryMood
  language: StoryLanguageCode
  scenes: StoryReelSourceScene[]
}

export type StoryReelMoment = {
  id: string
  scene: number
  caption: string
  prompt: string
  motif: StoryMotif
}

const PROMPT_BLOCKLIST = [
  /\b(answer|answers|response|responses|memory|memories|profile|private detail|private data|personal data)\b/iu,
  /\b(celebrity|living person|real person|public figure)\b/iu,
  /\b(marvel|dc comics|harry potter|star wars|disney|pokemon|mickey mouse|batman|superman)\b/iu,
  /https?:\/\//iu
]

function oneLine(value: string) {
  return value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function truncateStoryReelCaption(value: string, max = 88): string {
  const single = oneLine(value)
  if (!single) return ''
  const characters = Array.from(single)
  if (characters.length <= max) return single
  return `${characters.slice(0, Math.max(0, max - 1)).join('').trimEnd()}…`
}

export function sanitizeStoryReelPrompt(value: string, fallback: string): string {
  const candidate = oneLine(value)
  const blocked = !candidate || PROMPT_BLOCKLIST.some(pattern => pattern.test(candidate))
  const safe = blocked ? fallback : candidate
  return truncateStoryReelCaption(safe, 220)
}

export function sanitizeStoryReelSummary(value: string): string {
  const withoutAnswerEcho = value
    .replace(/your choice to[^.?!]{0,260}gives this moment its direction\.?/giu, '')
    .replace(/\b(answered|you answered|you wrote)\b[^.?!]{0,200}/giu, '')
  return truncateStoryReelCaption(oneLine(withoutAnswerEcho), 340)
}

export function parseStoryReelTheme(value: unknown): StoryReelTheme {
  return STORY_REEL_THEMES.includes(value as StoryReelTheme) ? value as StoryReelTheme : 'starlight'
}

function fallbackCaption(scene: StoryReelSourceScene): string {
  const firstSentence = scene.summary.match(/[^.?!。！？]+[.?!。！？]?/u)?.[0] ?? scene.summary
  return truncateStoryReelCaption(scene.title || firstSentence || `Moment ${scene.index + 1}`, 88)
}

function fallbackPrompt(source: StoryReelSource, scene: StoryReelSourceScene, caption: string): string {
  return sanitizeStoryReelPrompt(
    `${caption}. ${scene.summary}. Atmospheric, spoiler-light illustration, vertical 9:16, no text overlays, original characters only.`,
    `${source.title}. Atmospheric, spoiler-light illustration, vertical 9:16, no text overlays, original characters only.`
  )
}

function desiredMomentCount(sceneCount: number): number {
  if (sceneCount <= 4) return sceneCount
  if (sceneCount >= 6) return 6
  return 5
}

function evenlySpacedSceneIndexes(sceneCount: number, target: number): number[] {
  if (sceneCount <= target) return Array.from({ length: sceneCount }, (_, index) => index)
  const indexes = new Set<number>()
  for (let step = 0; step < target; step++) {
    indexes.add(Math.round(step * (sceneCount - 1) / Math.max(1, target - 1)))
  }
  return [...indexes].sort((first, second) => first - second)
}

export function fallbackStoryReelMoments(source: StoryReelSource): StoryReelMoment[] {
  const target = desiredMomentCount(source.scenes.length)
  return evenlySpacedSceneIndexes(source.scenes.length, target).map(index => {
    const scene = source.scenes[index]
    const caption = fallbackCaption(scene)
    const prompt = fallbackPrompt(source, scene, caption)
    return {
      id: `moment-${scene.index + 1}`,
      scene: scene.index,
      caption,
      prompt,
      motif: suggestStoryMotif(source.title, `${caption} ${scene.summary}`)
    }
  })
}

function ensureSceneIndex(value: unknown, sceneCount: number): number {
  if (!Number.isInteger(value)) return -1
  const index = Number(value) - 1
  return index >= 0 && index < sceneCount ? index : -1
}

export function normalizeStoryReelMoments(source: StoryReelSource, value: unknown): StoryReelMoment[] {
  if (!Array.isArray(value)) return fallbackStoryReelMoments(source)
  const fallbackByScene = new Map(fallbackStoryReelMoments(source).map(moment => [moment.scene, moment]))
  const selected: StoryReelMoment[] = []
  const seenScenes = new Set<number>()
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const entry = item as Record<string, unknown>
    const scene = ensureSceneIndex(entry.scene, source.scenes.length)
    if (scene < 0 || seenScenes.has(scene)) continue
    const base = fallbackByScene.get(scene)!
    const caption = truncateStoryReelCaption(typeof entry.caption === 'string' ? entry.caption : base.caption, 88)
    if (caption.length < 12) continue
    const prompt = sanitizeStoryReelPrompt(typeof entry.prompt === 'string' ? entry.prompt : base.prompt, base.prompt)
    selected.push({
      id: `moment-${scene + 1}`,
      scene,
      caption,
      prompt,
      motif: suggestStoryMotif(source.title, `${caption} ${prompt}`)
    })
    seenScenes.add(scene)
    if (selected.length === 6) break
  }
  if (selected.length < Math.min(4, source.scenes.length)) {
    for (const fallback of fallbackByScene.values()) {
      if (selected.length >= Math.min(6, source.scenes.length)) break
      if (seenScenes.has(fallback.scene)) continue
      selected.push(fallback)
      seenScenes.add(fallback.scene)
    }
  }
  return selected.length ? selected : fallbackStoryReelMoments(source)
}

export function storyReelTimeline(momentCount: number): {
  momentSeconds: number
  crossfadeSeconds: number
  endCardSeconds: number
  totalSeconds: number
} {
  const safeMoments = Math.max(1, Math.min(6, Math.floor(momentCount) || 1))
  const totalSeconds = Math.max(15, Math.min(30, safeMoments * 4 + 3))
  const endCardSeconds = Math.min(3, totalSeconds * 0.25)
  const momentSeconds = (totalSeconds - endCardSeconds) / safeMoments
  return {
    momentSeconds,
    crossfadeSeconds: Math.min(0.9, momentSeconds * 0.28),
    endCardSeconds,
    totalSeconds
  }
}

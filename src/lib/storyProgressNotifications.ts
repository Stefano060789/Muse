import { readDraft, writeDraft } from './browserDrafts'

export const STORY_PROGRESS_NOTIFICATIONS_KEY = 'muse-story-progress-notifications'
export const STORY_PROGRESS_NOTIFICATION_CHANGE_EVENT = 'muse-story-progress-notifications-changed'
const STORY_PROGRESS_SNAPSHOT_PREFIX = 'muse-story-progress-snapshots:'

export type StoryProgressSnapshot = {
  opened: number
  finished: number
  furthestScene: number | null
  sceneCount: number | null
}

export type StoryProgressNotification = {
  id: string
  storyId: string
  title: string
  message: string
}

export type StoryProgressEvent = {
  kind: 'first-open' | 'milestone' | 'completed'
  milestone: number
  message: string
}

function isEnabled(value: unknown): value is { enabled: boolean } {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).enabled === 'boolean')
}

export function loadStoryProgressNotificationsEnabled(): boolean {
  return readDraft(STORY_PROGRESS_NOTIFICATIONS_KEY, isEnabled)?.enabled ?? true
}

export function saveStoryProgressNotificationsEnabled(enabled: boolean): void {
  if (typeof enabled !== 'boolean') throw new Error('Choose whether to enable story progress notifications.')
  writeDraft(STORY_PROGRESS_NOTIFICATIONS_KEY, { enabled })
  window.dispatchEvent(new Event(STORY_PROGRESS_NOTIFICATION_CHANGE_EVENT))
}

function isSnapshot(value: unknown): value is StoryProgressSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const input = value as Record<string, unknown>
  return Number.isSafeInteger(input.opened) && Number(input.opened) >= 0 &&
    Number.isSafeInteger(input.finished) && Number(input.finished) >= 0 &&
    (input.furthestScene === null || (Number.isSafeInteger(input.furthestScene) && Number(input.furthestScene) >= 0)) &&
    (input.sceneCount === null || (Number.isSafeInteger(input.sceneCount) && Number(input.sceneCount) >= 1))
}

function isSnapshots(value: unknown): value is Record<string, StoryProgressSnapshot> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(value).every(([id, snapshot]) => Boolean(id) && isSnapshot(snapshot))
}

export function loadStoryProgressSnapshots(userId: string): Record<string, StoryProgressSnapshot> {
  if (!userId) throw new Error('Sign in to check shared-story progress.')
  return readDraft(`${STORY_PROGRESS_SNAPSHOT_PREFIX}${userId}`, isSnapshots) ?? {}
}

export function saveStoryProgressSnapshots(userId: string, value: Record<string, StoryProgressSnapshot>): void {
  if (!userId || !isSnapshots(value)) throw new Error('Shared-story progress could not be saved.')
  writeDraft(`${STORY_PROGRESS_SNAPSHOT_PREFIX}${userId}`, value)
}

export function storyProgressEvents(
  previous: StoryProgressSnapshot | null,
  current: StoryProgressSnapshot
): StoryProgressEvent[] {
  if (!isSnapshot(current)) throw new Error('The server returned invalid story progress for notifications.')
  if (!previous) return []
  if (!isSnapshot(previous)) throw new Error('Saved story progress notifications are invalid.')

  if (previous.opened === 0 && current.opened > 0) {
    return [{ kind: 'first-open', milestone: current.opened, message: 'Someone opened this gift story.' }]
  }
  if (current.finished > previous.finished) {
    return [{ kind: 'completed', milestone: current.finished, message: 'A recipient completed this gift story.' }]
  }
  if (previous.opened === 0 || current.opened === 0 ||
      previous.furthestScene === null || current.furthestScene === null ||
      current.furthestScene <= previous.furthestScene) return []

  if (current.sceneCount === null) {
    const previousMilestone = Math.floor(previous.furthestScene / 3)
    const currentMilestone = Math.floor(current.furthestScene / 3)
    return currentMilestone > previousMilestone
      ? [{ kind: 'milestone', milestone: currentMilestone, message: `The group reached ${currentMilestone * 3} live story actions.` }]
      : []
  }

  const progressMilestone = (scene: number) => Math.min(3, Math.floor(((scene + 1) / current.sceneCount!) * 4))
  const previousMilestone = progressMilestone(previous.furthestScene)
  const currentMilestone = progressMilestone(current.furthestScene)
  return currentMilestone > previousMilestone
    ? [{ kind: 'milestone', milestone: currentMilestone, message: 'A recipient reached a new story progress milestone.' }]
    : []
}

export type SharedStoryProgress = {
  opened: number
  inProgress: number
  solved: number
  skipped: number
  furthestScene: number | null
  sceneCount?: number | null
}

export function parseSharedStoryProgress(value: unknown): SharedStoryProgress {
  if (!value || typeof value !== 'object') throw new Error('Story progress was not returned. Try again.')
  const progress = value as Record<string, unknown>
  for (const field of ['opened', 'inProgress', 'solved', 'skipped']) {
    if (!Number.isSafeInteger(progress[field]) || Number(progress[field]) < 0) throw new Error('The server returned invalid story progress.')
  }
  if (progress.furthestScene !== null && (!Number.isSafeInteger(progress.furthestScene) || Number(progress.furthestScene) < 0)) {
    throw new Error('The server returned invalid story progress.')
  }
  if (progress.sceneCount !== undefined && progress.sceneCount !== null &&
      (!Number.isSafeInteger(progress.sceneCount) || Number(progress.sceneCount) < 1)) {
    throw new Error('The server returned an invalid scene count.')
  }
  return {
    opened: Number(progress.opened), inProgress: Number(progress.inProgress),
    solved: Number(progress.solved), skipped: Number(progress.skipped),
    furthestScene: progress.furthestScene === null ? null : Number(progress.furthestScene),
    ...(progress.sceneCount !== undefined ? { sceneCount: progress.sceneCount === null ? null : Number(progress.sceneCount) } : {})
  }
}

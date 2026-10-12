import { SharedStoryError } from './sharedStory'

export function storyStorageError(error?: unknown) {
  console.error('Private story storage failed', error instanceof Error ? error.name : 'Storage error')
  return new SharedStoryError('Private story storage is unavailable. Check the server configuration and shared-story migration.', 503)
}

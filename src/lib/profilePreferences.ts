import { readDraft, writeDraft } from './browserDrafts'

export const PROFILE_PREFERENCES_KEY = 'muse-profile-preferences'

function isProfilePreferences(value: unknown): value is { displayName: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const displayName = (value as Record<string, unknown>).displayName
  return typeof displayName === 'string' && displayName.length <= 40
}

export function loadProfileDisplayName(): string {
  return readDraft(PROFILE_PREFERENCES_KEY, isProfilePreferences)?.displayName ?? ''
}

export function saveProfileDisplayName(displayName: string): void {
  const normalized = displayName.trim()
  if (normalized.length > 40) throw new Error('Your name must be 40 characters or fewer.')
  writeDraft(PROFILE_PREFERENCES_KEY, { displayName: normalized })
}

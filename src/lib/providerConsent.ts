import { SharedStoryError } from './sharedStory'
import { MUSE_AI_CONSENT_VERSION } from './legalContact'
import type { AccountPermissions } from './accountPermissions'

export const PROVIDER_CONSENT_VERSION = MUSE_AI_CONSENT_VERSION
export function requireProviderConsent(body: unknown, permissions?: AccountPermissions) {
  if (permissions?.managed) {
    if (!permissions.services) throw new SharedStoryError('Enable Muse processing permission in Settings before using AI or cloud audio.', 403)
    return
  }
  if (!body || typeof body !== 'object' || !('consentVersion' in body) || body.consentVersion !== PROVIDER_CONSENT_VERSION) {
    throw new SharedStoryError('Please review and accept AI data processing before sending story text.', 400)
  }
}

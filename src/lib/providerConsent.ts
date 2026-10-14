import { SharedStoryError } from './sharedStory'
import { MUSE_AI_CONSENT_VERSION } from './legalContact'

export const PROVIDER_CONSENT_VERSION = MUSE_AI_CONSENT_VERSION
export function requireProviderConsent(body: unknown) {
  if (!body || typeof body !== 'object' || !('consentVersion' in body) || body.consentVersion !== PROVIDER_CONSENT_VERSION) {
    throw new SharedStoryError('Please review and accept AI data processing before sending story text.', 400)
  }
}

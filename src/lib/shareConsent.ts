import { MUSE_AI_CONSENT_VERSION } from './legalContact'

export const SHARE_CONSENT_METADATA_KEY = 'muse_share_teaser_consent'
export type ShareConsentRecord = { version: string; acceptedAt: string }

export function hasShareConsent(metadata: Record<string, unknown> | undefined): boolean {
  const record = metadata?.[SHARE_CONSENT_METADATA_KEY]
  if (!record || typeof record !== 'object') return false
  const value = record as Record<string, unknown>
  return value.version === MUSE_AI_CONSENT_VERSION && typeof value.acceptedAt === 'string' &&
    Number.isFinite(Date.parse(value.acceptedAt))
}

export function shareConsentUpdate(accepted: boolean) {
  return {
    [SHARE_CONSENT_METADATA_KEY]: accepted
      ? { version: MUSE_AI_CONSENT_VERSION, acceptedAt: new Date().toISOString() } : null
  }
}

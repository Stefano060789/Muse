export type ContactSetting = {
  value: string | null
  status: 'configured' | 'missing' | 'invalid'
}

export type PublicContactConfig = {
  operator: ContactSetting
  supportEmail: ContactSetting
}

export const MUSE_AI_CONSENT_VERSION = '2026-10-18'

function operatorSetting(value: string | undefined): ContactSetting {
  const normalized = value?.trim() || ''
  if (!normalized) return { value: null, status: 'missing' }
  if (normalized.length > 120 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    return { value: null, status: 'invalid' }
  }
  return { value: normalized, status: 'configured' }
}

function supportSetting(value: string | undefined): ContactSetting {
  const normalized = value?.trim() || ''
  if (!normalized) return { value: null, status: 'missing' }
  const parts = normalized.split('@')
  const local = parts[0] || ''
  const domain = parts[1] || ''
  const validEmail = normalized.length <= 254 && parts.length === 2 &&
    Boolean(local) && local.length <= 64 &&
    !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') &&
    /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) &&
    Boolean(domain) &&
    domain.split('.').every(label => label.length > 0 && label.length <= 63 &&
      /^[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/i.test(label)) &&
    domain.includes('.')
  return validEmail
    ? { value: normalized, status: 'configured' }
    : { value: null, status: 'invalid' }
}

export function getPublicContactConfig(
  operatorName: string | undefined,
  supportEmail: string | undefined
): PublicContactConfig {
  return {
    operator: operatorSetting(operatorName),
    supportEmail: supportSetting(supportEmail)
  }
}

export function hasExplicitConsent(accepted: boolean | undefined): boolean {
  return accepted === true
}

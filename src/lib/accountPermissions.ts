export const ACCOUNT_PERMISSIONS_KEY = 'muse_registration_permissions'
export const ACCOUNT_PERMISSIONS_VERSION = '2026-10-31'
export type AccountPermissions = { managed: boolean; services: boolean; romance: boolean }

export function accountPermissions(metadata: Record<string, unknown> | undefined): AccountPermissions {
  const record = metadata?.[ACCOUNT_PERMISSIONS_KEY]
  if (!record || typeof record !== 'object') return { managed: false, services: false, romance: false }
  const value = record as Record<string, unknown>
  const valid = value.version === ACCOUNT_PERMISSIONS_VERSION && typeof value.acceptedAt === 'string' &&
    Number.isFinite(Date.parse(value.acceptedAt))
  return { managed: true, services: valid && value.services === true, romance: valid && value.romance === true }
}

export function accountPermissionsUpdate(services: boolean, romance: boolean) {
  return { [ACCOUNT_PERMISSIONS_KEY]: {
    version: ACCOUNT_PERMISSIONS_VERSION, acceptedAt: new Date().toISOString(), services, romance
  } }
}

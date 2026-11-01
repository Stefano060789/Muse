export const ACCOUNT_PERMISSIONS_KEY = 'muse_registration_permissions'
export const ACCOUNT_PERMISSIONS_VERSION = '2026-11-01'
export const CLOUD_AUDIO_PERMISSION_KEY = 'muse_cloud_audio_permission'
export type AccountPermissions = { managed: boolean; services: boolean; romance: boolean; cloudAudio?: boolean }

export function accountPermissions(metadata: Record<string, unknown> | undefined): AccountPermissions {
  const record = metadata?.[ACCOUNT_PERMISSIONS_KEY]
  if (!record || typeof record !== 'object') {
    const audio = metadata?.[CLOUD_AUDIO_PERMISSION_KEY]
    const value = audio && typeof audio === 'object' ? audio as Record<string, unknown> : undefined
    return { managed: false, services: false, romance: false, ...(audio === undefined ? {} : {
      cloudAudio: value?.version === ACCOUNT_PERMISSIONS_VERSION && typeof value.acceptedAt === 'string' &&
        Number.isFinite(Date.parse(value.acceptedAt)) && value.accepted === true
    }) }
  }
  const value = record as Record<string, unknown>
  const valid = value.version === ACCOUNT_PERMISSIONS_VERSION && typeof value.acceptedAt === 'string' &&
    Number.isFinite(Date.parse(value.acceptedAt))
  return { managed: true, services: valid && value.services === true, romance: valid && value.romance === true }
}

export function cloudAudioPermissionUpdate(accepted: boolean) {
  return { [CLOUD_AUDIO_PERMISSION_KEY]: { version: ACCOUNT_PERMISSIONS_VERSION, acceptedAt: new Date().toISOString(), accepted } }
}

export function accountPermissionsUpdate(services: boolean, romance: boolean) {
  return { [ACCOUNT_PERMISSIONS_KEY]: {
    version: ACCOUNT_PERMISSIONS_VERSION, acceptedAt: new Date().toISOString(), services, romance
  } }
}

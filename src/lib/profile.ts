export type MuseProfile = {
  about: string
  keypoints: string[]
  updatedAt: string
}

const PROFILE_STORAGE_KEY = 'muse-profile'

export function extractProfileKeypoints(about: string) {
  return about
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => sentence.length > 180 ? `${sentence.slice(0, 177).trimEnd()}...` : sentence)
    .slice(0, 5)
}

export function loadMuseProfile(): MuseProfile | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as MuseProfile
  } catch {
    window.localStorage.removeItem(PROFILE_STORAGE_KEY)
    return null
  }
}

export function saveMuseProfile(about: string) {
  const keypoints = extractProfileKeypoints(about)
  const profile: MuseProfile = {
    about: keypoints.join('. '),
    keypoints,
    updatedAt: new Date().toISOString()
  }
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  return profile
}

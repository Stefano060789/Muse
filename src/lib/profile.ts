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
  let raw: string | null
  try {
    raw = window.localStorage.getItem(PROFILE_STORAGE_KEY)
  } catch {
    throw new Error('This browser cannot read your memories. Check browser storage permissions; you can still write without saving.')
  }
  if (!raw) return null

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error('Saved memories are damaged. They have not been overwritten. Use Forget everything to reset them.')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Saved memories are invalid. Use Forget everything to reset them.')
  }
  const profile = value as Record<string, unknown>
  if (typeof profile.about !== 'string' || !Array.isArray(profile.keypoints) || profile.keypoints.length > 20 ||
    !profile.keypoints.every((point) => typeof point === 'string' && point.trim().length > 0 && point.length <= 180) ||
    typeof profile.updatedAt !== 'string' || !Number.isFinite(Date.parse(profile.updatedAt))) {
    throw new Error('Saved memories are invalid. They have not been overwritten. Use Forget everything to reset them.')
  }
  return { about: profile.about, keypoints: profile.keypoints, updatedAt: profile.updatedAt }
}

export function replaceMuseProfileKeypoints(points: string[]): MuseProfile {
  if (!Array.isArray(points) || points.length > 20 ||
    points.some((point) => typeof point !== 'string' || !point.trim() || point.length > 180)) {
    throw new Error('Keep up to 20 non-empty memories of at most 180 characters each.')
  }
  const keypoints = points.map((point) => point.trim())
    .filter((point, index, points) => points.findIndex((candidate) => candidate.toLowerCase() === point.toLowerCase()) === index)
  const profile: MuseProfile = {
    about: keypoints.join('. '),
    keypoints,
    updatedAt: new Date().toISOString()
  }
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  } catch {
    throw new Error('Your memories could not be saved. Browser storage may be full or blocked. Your previous saved memories are unchanged; keep a copy of your text.')
  }
  return profile
}

export function saveMuseProfile(about: string): MuseProfile {
  return appendMuseProfileKeypoints(extractProfileKeypoints(about))
}

export function saveMuseProfileReflection(topic: string, reflection: string): MuseProfile {
  const prompt = topic.trim()
  if (!prompt || prompt.length > 100) throw new Error('Choose a topic before saving your reflection.')
  const memories = extractProfileKeypoints(reflection)
  if (!memories.length) throw new Error('Add something about this topic before saving it.')
  const contextualMemories = memories.map((memory) => {
    const prefix = `${prompt}: `
    const available = 180 - prefix.length
    if (available < 1) throw new Error('This topic is too long to save as a memory.')
    return `${prefix}${memory.length > available ? `${memory.slice(0, available - 3).trimEnd()}...` : memory}`
  })
  return appendMuseProfileKeypoints(contextualMemories)
}

function appendMuseProfileKeypoints(additions: string[]): MuseProfile {
  const previous = loadMuseProfile()
  const points = [...(previous?.keypoints || []), ...additions]
    .filter((point, index, all) => all.findIndex((candidate) => candidate.toLowerCase() === point.toLowerCase()) === index)
  if (points.length > 20) {
    throw new Error('You have reached 20 memories. Edit or remove existing memories before adding more.')
  }
  return replaceMuseProfileKeypoints(points)
}

export function forgetMuseProfile(): void {
  try {
    window.localStorage.removeItem(PROFILE_STORAGE_KEY)
  } catch {
    throw new Error('Memories could not be removed. Check browser storage permissions and try again.')
  }
}

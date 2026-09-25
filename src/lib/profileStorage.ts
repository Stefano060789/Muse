import fs from 'fs'
import path from 'path'

export type MuseProfile = {
  about: string
  keypoints: string[]
  updatedAt: string
}

const dataDir = path.join(process.cwd(), 'data')
const dataFile = path.join(dataDir, 'muse-profile.json')

export async function readMuseProfile(): Promise<MuseProfile | null> {
  try {
    const text = await fs.promises.readFile(dataFile, 'utf8')
    if (!text.trim()) return null
    return JSON.parse(text) as MuseProfile
  } catch {
    return null
  }
}

export async function writeMuseProfile(profile: MuseProfile) {
  await fs.promises.mkdir(dataDir, { recursive: true })
  await fs.promises.writeFile(dataFile, JSON.stringify(profile, null, 2), 'utf8')
}

export function extractProfileKeypoints(about: string) {
  return about
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 8)
}

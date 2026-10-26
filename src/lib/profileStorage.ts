import fs from 'fs'
import path from 'path'

export type MuseProfile = {
  about: string
  keypoints: string[]
  updatedAt: string
}

const dataDir = path.join(process.cwd(), 'data')
const accountFile = (accountId: string) => path.join(dataDir, `muse-profile-${createHash('sha256').update(accountId).digest('hex')}.json`)

export async function readMuseProfile(accountId: string): Promise<MuseProfile | null> {
  try {
    const text = await fs.promises.readFile(accountFile(accountId), 'utf8')
    if (!text.trim()) return null
    return JSON.parse(text) as MuseProfile
  } catch {
    return null
  }
}

export async function writeMuseProfile(profile: MuseProfile, accountId: string) {
  await fs.promises.mkdir(dataDir, { recursive: true })
  await fs.promises.writeFile(accountFile(accountId), JSON.stringify(profile, null, 2), 'utf8')
}

export function extractProfileKeypoints(about: string) {
  return about
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 8)
}
import { createHash } from 'crypto'

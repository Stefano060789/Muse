import fs from 'fs'
import path from 'path'

export type StoryRecord = {
  id: string
  title: string
  description: string
  partnerA: string
  partnerB: string
  templateKey: string
  currentBeat: number
  createdAt: string
  responses: Record<string, string>
  profileKeypoints?: string[]
  beats: Array<{
    id: string
    number: number
    title: string
    body: string
    clue: string
    tone: 'mystery' | 'warm' | 'playful' | 'dreamy'
  }>
}

const dataDir = path.join(process.cwd(), 'data')
const accountFile = (accountId: string) => path.join(dataDir, `story-state-${createHash('sha256').update(accountId).digest('hex')}.json`)

export async function readStoryState(accountId: string): Promise<StoryRecord | null> {
  try {
    const text = await fs.promises.readFile(accountFile(accountId), 'utf8')
    if (!text.trim()) return null
    return JSON.parse(text) as StoryRecord
  } catch {
    return null
  }
}

export async function writeStoryState(story: StoryRecord, accountId: string) {
  await fs.promises.mkdir(dataDir, { recursive: true })
  await fs.promises.writeFile(accountFile(accountId), JSON.stringify(story, null, 2), 'utf8')
}
import { createHash } from 'crypto'

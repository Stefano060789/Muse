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
const dataFile = path.join(dataDir, 'story-state.json')

export async function readStoryState(): Promise<StoryRecord | null> {
  try {
    const text = await fs.promises.readFile(dataFile, 'utf8')
    if (!text.trim()) return null
    return JSON.parse(text) as StoryRecord
  } catch {
    return null
  }
}

export async function writeStoryState(story: StoryRecord) {
  await fs.promises.mkdir(dataDir, { recursive: true })
  await fs.promises.writeFile(dataFile, JSON.stringify(story, null, 2), 'utf8')
}

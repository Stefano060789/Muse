export type StoryBeat = {
  id: string
  number: number
  title: string
  body: string
  clue: string
  tone: 'mystery' | 'warm' | 'playful' | 'dreamy'
}

export type StoryArc = {
  id: string
  title: string
  description: string
  partnerA: string
  partnerB: string
  templateKey: string
  beats: StoryBeat[]
  currentBeat: number
  createdAt: string
  responses: Record<string, string>
  profileKeypoints?: string[]
}

export type StoryTemplate = {
  key: string
  title: string
  description: string
  beatTitles: string[]
  beats: Array<{
    title: string
    body: string
    clue: string
    tone: StoryBeat['tone']
  }>
}

export const STORY_TEMPLATES: StoryTemplate[] = [
  {
    key: 'letter-in-the-drawer',
    title: 'The Letter in the Drawer',
    description: 'A quiet mystery about a message hidden before the two of you were ready to say it aloud.',
    beatTitles: ['The drawer', 'The wax seal', 'The map', 'The answer', 'The future'],
    beats: [
      {
        title: 'The drawer',
        body: 'In the middle of a rainy evening, a small envelope appears in a drawer neither of you remembers opening.',
        clue: 'A little word is written in the corner: “Look where we used to go.”',
        tone: 'mystery'
      },
      {
        title: 'The wax seal',
        body: 'Inside, a seal bears a familiar shape from one of your earliest memories together.',
        clue: 'The seal points to a place where your laughter once changed the air.',
        tone: 'warm'
      },
      {
        title: 'The map',
        body: 'A folded scrap of paper unfolds into a map of the places that made you feel like home.',
        clue: 'Find the place the two of you imagined but never named aloud.',
        tone: 'dreamy'
      },
      {
        title: 'The answer',
        body: 'The final note is no longer a clue but a promise. It asks for the truth you have both been carrying.',
        clue: 'What is the promise you want to make before the next time you meet?',
        tone: 'playful'
      },
      {
        title: 'The future',
        body: 'The letter closes not with an ending, but with a door that opens toward the next version of you both.',
        clue: 'What would a beautiful next chapter feel like?',
        tone: 'warm'
      }
    ]
  },
  {
    key: 'the-missing-key',
    title: 'The Missing Key',
    description: 'A tiny mystery built around the object that unlocks the next chapter of your story together.',
    beatTitles: ['The key', 'The lock', 'The hidden room', 'The promise', 'The reveal'],
    beats: [
      {
        title: 'The key',
        body: 'A brass key appears on your nightstand with no explanation and a note that only says “some doors stay closed until both of you are ready.”',
        clue: 'Look for the place where you first felt safe together.',
        tone: 'mystery'
      },
      {
        title: 'The lock',
        body: 'The key fits nothing you can see, until the memory of a doorway returns in flashes.',
        clue: 'The door is not physical. It is a version of the future you can imagine together.',
        tone: 'dreamy'
      },
      {
        title: 'The hidden room',
        body: 'Behind the memory there is a room shaped by your favorite conversations, quiet laughter, and brave hopes.',
        clue: 'What did you wish for before either of you said it out loud?',
        tone: 'warm'
      },
      {
        title: 'The promise',
        body: 'There is no treasure here. There is only a place for the next honest sentence between you.',
        clue: 'What do you want to say that you have been waiting to say?',
        tone: 'playful'
      },
      {
        title: 'The reveal',
        body: 'The room opens with a quiet glow and a final note: the best future is the one both of you build with intention.',
        clue: 'What would your ideal next chapter look like?',
        tone: 'warm'
      }
    ]
  }
]

const STORAGE_KEY = 'muse-story-arc'

export function createStoryArc(
  templateKey: string,
  partnerA: string,
  partnerB: string,
  profileKeypoints: string[] = []
): StoryArc {
  const template = STORY_TEMPLATES.find((item) => item.key === templateKey) || STORY_TEMPLATES[0]
  const personalCue = profileKeypoints.length > 0
    ? ` Threads from your life run quietly through this chapter: ${profileKeypoints.slice(0, 3).join(' ')}.`
    : ''

  return {
    id: `story-${Date.now()}`,
    title: template.title,
    description: template.description,
    partnerA: partnerA.trim() || 'You',
    partnerB: partnerB.trim() || 'Your partner',
    templateKey: template.key,
    beats: template.beats.map((beat, index) => ({
      id: `${template.key}-${index + 1}`,
      number: index + 1,
      title: beat.title,
      body: index === 0 ? `${beat.body}${personalCue}` : beat.body,
      clue: beat.clue,
      tone: beat.tone
    })),
    currentBeat: 0,
    createdAt: new Date().toISOString(),
    responses: {},
    profileKeypoints
  }
}

export function loadStoryArc(): StoryArc | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoryArc
  } catch {
    return null
  }
}

export function saveStoryArc(story: StoryArc) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(story))
}

export function answerCurrentBeat(story: StoryArc, response: string): StoryArc {
  const trimmed = response.trim()
  if (!trimmed) return story

  const nextStory = { ...story, responses: { ...story.responses } }
  nextStory.responses[String(story.currentBeat + 1)] = trimmed

  const nextBeatIndex = Math.min(story.currentBeat + 1, story.beats.length - 1)
  nextStory.currentBeat = nextBeatIndex

  return nextStory
}

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
  difficulty?: 'gentle' | 'clever' | 'challenging'
  durationMinutes?: number
  goalType?: 'location' | 'item' | 'letter' | 'puzzle'
  solution?: string
  completionMessage?: string
  solved?: boolean
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

export type PersonalStoryMood = 'adventure' | 'relaxed' | 'curious' | 'hopeful'

export type PersonalStory = {
  id: string
  mood: PersonalStoryMood
  title: string
  description: string
  currentStep: number
  createdAt: string
  responses: string[]
  scenes: Array<{
    title: string
    body: string
    question: string
    choices: string[]
  }>
}

const PERSONAL_STORY_STORAGE_KEY = 'muse-personal-story'

const PERSONAL_STORY_SCENES: Record<PersonalStoryMood, PersonalStory['scenes']> = {
  adventure: [
    { title: 'The open road', body: 'The day gives you a small invitation: a path you have not taken, a door that is not locked, and enough courage for one first step.', question: 'What kind of next step feels right?', choices: ['Something bold and unfamiliar', 'A small change with room to grow', 'I want to wander without a plan'] },
    { title: 'A useful detour', body: 'The path turns away from the map. Instead of losing the way, you notice that the detour has been waiting for your attention.', question: 'What will you make space for?', choices: ['A new possibility', 'A conversation I have postponed', 'Rest before I continue'] },
    { title: 'Your own compass', body: 'By evening, the road is no longer asking you to prove anything. It is simply showing you that you can choose your direction again.', question: 'What do you want to carry forward?', choices: ['Curiosity', 'Courage', 'A gentler pace'] }
  ],
  relaxed: [
    { title: 'A softer hour', body: 'Nothing is asking to be solved immediately. The room grows quieter, and your attention returns to the small things that make you feel held.', question: 'What would help you soften today?', choices: ['Quiet and no expectations', 'A familiar ritual', 'Being close to someone I trust'] },
    { title: 'The pause', body: 'In the pause between one thought and the next, you remember that rest is not a reward. It is part of how you keep going.', question: 'What can wait until tomorrow?', choices: ['My unfinished list', 'The need to have an answer', 'The pressure to be available'] },
    { title: 'A little more room', body: 'The day ends with more room inside it. You do not need to fill every corner; some space can simply belong to you.', question: 'What feeling is staying with you?', choices: ['Relief', 'Warmth', 'Quiet hope'] }
  ],
  curious: [
    { title: 'The unusual detail', body: 'Something ordinary refuses to stay ordinary: a phrase, a pattern, or a question that keeps returning at the edge of your attention.', question: 'What would you like to understand better?', choices: ['A feeling I keep returning to', 'A possibility I have ignored', 'The story behind a familiar thing'] },
    { title: 'Follow the question', body: 'You follow the question without demanding an immediate answer. Each turn reveals another detail, and the uncertainty begins to feel alive.', question: 'Where should your attention go next?', choices: ['Toward learning', 'Toward another person', 'Toward my own imagination'] },
    { title: 'A new perspective', body: 'The answer is not a conclusion. It is a window: a way to see the same life with slightly more room for surprise.', question: 'What will you look at differently?', choices: ['My current challenge', 'A relationship', 'My next season'] }
  ],
  hopeful: [
    { title: 'A small light', body: 'Hope does not arrive loudly. It appears as one small thing that still feels possible, even after a difficult day.', question: 'What feels possible right now?', choices: ['Starting again', 'Asking for help', 'Making one small promise to myself'] },
    { title: 'The next kind thing', body: 'You do not need a perfect plan. The next kind thing is enough to give the future somewhere to begin.', question: 'Who deserves your care today?', choices: ['Myself', 'Someone I love', 'The part of me that is still learning'] },
    { title: 'A beginning', body: 'The story does not finish here. It leaves you with a beginning you can return to whenever you need to remember that change can be gentle.', question: 'What would you like this story to remind you?', choices: ['I am allowed to begin again', 'I can move at my own pace', 'There is more ahead'] }
  ]
}

export function inferPersonalStoryMood(response: string): PersonalStoryMood {
  const text = response.toLowerCase()
  if (/(tired|rest|calm|relax|overwhel|quiet|slow)/.test(text)) return 'relaxed'
  if (/(curious|wonder|learn|question|understand|explore)/.test(text)) return 'curious'
  if (/(hope|future|heal|start|stuck|difficult|sad)/.test(text)) return 'hopeful'
  return 'adventure'
}

export function createPersonalStory(mood: PersonalStoryMood, profileKeypoints: string[] = []): PersonalStory {
  const scenes = PERSONAL_STORY_SCENES[mood]
  const personalDetail = profileKeypoints[0] ? ` It carries a quiet trace of ${profileKeypoints[0].toLowerCase()}.` : ''
  return {
    id: `personal-${Date.now()}`,
    mood,
    title: mood === 'relaxed' ? 'The Soft Place' : mood === 'curious' ? 'The Question That Stayed' : mood === 'hopeful' ? 'A Small Light' : 'The Open Road',
    description: `A personalized ${mood} story shaped by what you need today.${personalDetail}`,
    currentStep: 0,
    createdAt: new Date().toISOString(),
    responses: [],
    scenes
  }
}

export function loadPersonalStory(): PersonalStory | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(PERSONAL_STORY_STORAGE_KEY)
  if (!raw) return null
  try {
    const story = JSON.parse(raw) as PersonalStory
    if (story.title === 'The Unmapped Day') {
      story.title = 'The Open Road'
      window.localStorage.setItem(PERSONAL_STORY_STORAGE_KEY, JSON.stringify(story))
    }
    return story
  } catch {
    window.localStorage.removeItem(PERSONAL_STORY_STORAGE_KEY)
    return null
  }
}

export function savePersonalStory(story: PersonalStory) {
  window.localStorage.setItem(PERSONAL_STORY_STORAGE_KEY, JSON.stringify(story))
}

export function answerPersonalStory(story: PersonalStory, answer: string) {
  const nextStory = { ...story, responses: [...story.responses, answer.trim()] }
  nextStory.currentStep = Math.min(story.currentStep + 1, story.scenes.length - 1)
  if (nextStory.currentStep !== story.currentStep) {
    nextStory.scenes = nextStory.scenes.map((scene, index) => (
      index === nextStory.currentStep
        ? { ...scene, body: `${scene.body} Your choice to ${answer.trim().toLowerCase()} gives this moment its direction.` }
        : scene
    ))
  }
  return nextStory
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
  profileKeypoints: string[] = [],
  options: Pick<StoryArc, 'difficulty' | 'durationMinutes' | 'goalType' | 'solution' | 'completionMessage'> = {}
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
    profileKeypoints,
    difficulty: options.difficulty || 'gentle',
    durationMinutes: options.durationMinutes || 15,
    goalType: options.goalType || 'puzzle',
    solution: options.solution?.trim() || undefined,
    completionMessage: options.completionMessage?.trim() || 'You solved the story.',
    solved: false
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
  if (story.solution && trimmed.toLowerCase().includes(story.solution.toLowerCase())) {
    nextStory.solved = true
  }

  return nextStory
}

export function encodeSharedStory(story: StoryArc) {
  if (typeof window === 'undefined') return ''
  return window.btoa(unescape(encodeURIComponent(JSON.stringify(story))))
}

export function decodeSharedStory(value: string): StoryArc | null {
  try {
    return JSON.parse(decodeURIComponent(escape(window.atob(value)))) as StoryArc
  } catch {
    return null
  }
}

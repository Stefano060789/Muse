export const PERSONAL_STORY_DIFFICULTIES = ['gentle', 'easy', 'balanced', 'challenging', 'expert'] as const
export type PersonalStoryDifficulty = typeof PERSONAL_STORY_DIFFICULTIES[number]

export function isPersonalStoryDifficulty(value: unknown): value is PersonalStoryDifficulty {
  return typeof value === 'string' && PERSONAL_STORY_DIFFICULTIES.some(level => level === value)
}

const instructions: Record<PersonalStoryDifficulty, string> = {
  gentle: 'Level 1: Guide the player through the unfolding story with clear signposts, supportive characters and obvious helpful clues. Keep obstacles simple and reassuring.',
  easy: 'Level 2: Offer gentle choices and approachable obstacles. Give clear clues and timely guidance while allowing the player to choose their own direction.',
  balanced: 'Level 3: Offer meaningful choices and a few fair obstacles that reward noticing and connecting clues. Give guidance when needed without deciding for the player.',
  challenging: 'Level 4: Introduce more complex obstacles, subtle clues and meaningful consequences. Reward attention and experimentation; let unexpected choices change the story.',
  expert: 'Level 5: Introduce fair fictional traps, plausible misleading clues, tricks and unexpected detours that challenge the player and can change the story direction. Make them discoverable from details in the story and allow creative recovery or a different path; never force a predetermined outcome.'
}

export function personalDifficultyInstruction(difficulty: PersonalStoryDifficulty): string {
  return `${instructions[difficulty]} Never use timers, obscure outside knowledge or dead ends.`
}

export const PERSONAL_IMPROVEMENT_INSTRUCTION =
  'At every difficulty, when an improvementGoal is supplied, weave it into the evolving story through relevant situations, choices and perspectives that can help the player explore what they want to change or improve. Respect the player’s agency and changing direction. Do not prescribe a correct choice, manipulate the player, promise improvement, diagnose, give therapy or force a lesson. Do not invent a goal when none is provided.'

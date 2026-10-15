export const SAMPLE_STORY = {
  title: 'The lantern at the little station',
  dedication: 'For anyone who could use a small, unexpected adventure.',
  scenes: [
    { title: 'A ticket with no destination', body: 'At a quiet station, Alex finds a paper ticket tucked under a cup of tea. On the back, Sam has written: "No trains today. Follow the little lights instead." Three painted lanterns lead from the platform toward a garden gate.', clue: 'Look for a place where people can pause together.' },
    { title: 'The garden beyond the gate', body: 'Inside the garden, a red ribbon is tied around a small wooden bench. Beside it is a covered basket and a note: "You bring the stories. I will bring something warm to drink." A checked blanket peeks out from beneath the lid. Nothing here needs a grand occasion.', clue: 'A basket, a blanket, and food shared outside. What has Sam planned?' }
  ],
  answer: 'picnic',
  message: 'A picnic, just for us. No rush, no special occasion. Sometimes the best gift is a little time together.'
}

export function sampleAnswerMatches(value: string): boolean {
  return ['picnic', 'a picnic'].includes(value.trim().toLowerCase().replace(/[.!?]+$/, '').trim())
}

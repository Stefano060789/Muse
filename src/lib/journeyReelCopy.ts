import type { StoryLanguageCode } from './storyLanguage'

const english = {
  title: 'Create my journey reel',
  intro: 'Review each card before rendering. Everything stays on this device.',
  privacy: 'You can edit or hide every scene card. Nothing is uploaded and no AI is used.',
  showChoices: 'Show my choices',
  showChoicesHint: 'When off, cards show only scene titles.',
  consent: 'I confirm I want to include my personal answers in this reel.',
  includeCard: 'Include this card',
  choiceLabel: 'Choice text',
  hideChoiceEditor: 'No saved choice for this scene.',
  sceneFallback: 'Scene {number}',
  render: 'Render reel',
  rendering: 'Rendering reel — keep this tab open',
  cancel: 'Cancel',
  cancelled: 'Rendering cancelled.',
  ready: 'Reel ready.',
  unsupported: 'This browser cannot render video here. Try a current Safari or Chrome browser.',
  error: 'Could not render the reel. Keep this tab visible and try again.',
  download: 'Download reel',
  share: 'Share reel',
  fileUnsupported: 'This browser cannot share video files directly. Download the reel and upload it in your app.',
  downloaded: 'Reel downloaded.',
  webmNote: 'This reel is WebM. Instagram and TikTok usually require MP4 uploads.',
  preview: 'Journey reel preview',
  progress: 'Progress',
  chosePrefix: 'I chose:',
  endingTitle: 'Made with Muse',
  soundtrackPrefix: 'Music',
  noCards: 'Keep at least one scene card visible before rendering.'
} as const

type Copy = Record<keyof typeof english, string>

const copies: Partial<Record<StoryLanguageCode, Partial<Copy>>> = {
  'en-US': english
}

export function journeyReelCopy(language: StoryLanguageCode): Copy {
  return { ...english, ...(copies[language] ?? {}) }
}

import type { StoryLanguageCode } from './storyLanguage'

const english = {
  open: 'Create my story reel',
  intro: 'Turn this completed story into a short 9:16 reel (about 15–30 seconds).',
  loading: 'Preparing spoiler-light moments…',
  fallback: 'Using local safe fallback moments. You can still edit everything before rendering.',
  moments: 'Reel moments',
  includeMoment: 'Include this moment',
  caption: 'Caption',
  prompt: 'Image prompt',
  theme: 'Visual theme',
  render: 'Render reel preview',
  rendering: 'Rendering reel… keep this tab visible',
  cancel: 'Cancel rendering',
  providerEstimate: 'Estimated usage with image provider',
  providerDisclosure: 'When enabled, Muse sends only this story summary and edited image prompts to the selected image provider. Your typed answers are never sent.',
  providerConsent: 'I agree to send this story summary and image prompts to the image provider for reel images.',
  providerDisabled: 'No image provider is enabled. Muse will use local artwork templates at zero external cost.',
  premiumTitle: 'Premium opening/ending AI shots',
  premiumDisabled: 'Premium shots are disabled pending commercial entitlement review.',
  ready: 'Reel preview ready. Play it before sharing.',
  download: 'Download reel',
  share: 'Share reel',
  unsupported: 'This browser cannot render video here. Try current Safari or Chrome.',
  shareUnsupported: 'This browser cannot share video files directly. Download first, then upload in your social app.',
  error: 'Could not create the reel. Keep this tab visible and try again.',
  mp4Preferred: 'MP4 is preferred for Instagram/TikTok/Shorts.',
  webmNote: 'This export is WebM. Instagram and TikTok usually require MP4.',
  attributionPrefix: 'Music attribution:',
  narration: 'Optional narration audio',
  narrationHint: 'Choose a local narration file (optional).',
  reviewed: 'I reviewed captions, selected moments and theme. Render now.',
  noMoments: 'Select at least one moment.',
  videoLabel: 'Story reel preview'
} as const

type Copy = Record<keyof typeof english, string>

const copies: Partial<Record<StoryLanguageCode, Partial<Copy>>> = {
  'it-IT': { open: 'Crea il mio reel della storia' },
  'es-ES': { open: 'Crear mi reel de la historia' },
  'zh-CN': { open: '创建我的故事短片' },
  'hi-IN': { open: 'मेरा स्टोरी रील बनाएँ' },
  'uk-UA': { open: 'Створити мій ріл історії' },
  'ar-SA': { open: 'أنشئ ريل قصتي' }
}

export function storyReelCopy(language: StoryLanguageCode): Copy {
  return { ...english, ...(copies[language] || {}) }
}

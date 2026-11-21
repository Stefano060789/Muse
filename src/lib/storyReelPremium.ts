export type StoryReelPremiumStatus = {
  available: boolean
  reason: 'commercial-entitlement-required'
  message: string
}

export type StoryReelVideoProvider = {
  key: string
  createOpeningShot: () => Promise<never>
  createEndingShot: () => Promise<never>
}

export function storyReelPremiumStatus(): StoryReelPremiumStatus {
  return {
    available: false,
    reason: 'commercial-entitlement-required',
    message: 'Premium AI opening/ending video shots are disabled pending commercial entitlement review.'
  }
}

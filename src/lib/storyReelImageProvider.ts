import { createStoryMomentSvg } from './personalStoryShareVisual'
import { storyLanguage } from './storyLanguage'
import { suggestStoryMotif } from './storyShareArtwork'
import { SharedStoryError } from './sharedStory'
import { reserveStoryReelImageAttempt, storyReelUserDailyCaps } from './storyReelLimits'
import type { StoryReelMoment, StoryReelSource, StoryReelTheme } from './storyReelLogic'

type StoryReelImageProviderKey = 'none' | 'mock'

export type StoryReelImageProviderStatus = {
  enabled: boolean
  provider: StoryReelImageProviderKey
  reason: string
  estimatedAiAttemptsPerImage: number
  userDailyCap: number
}

export type StoryReelProviderImage = {
  id: string
  dataUrl: string
  provider: string
}

function providerKey(): StoryReelImageProviderKey {
  const value = (process.env.MUSE_STORY_REEL_IMAGE_PROVIDER || 'none').trim().toLowerCase()
  return value === 'mock' ? 'mock' : 'none'
}

export function storyReelImageProviderStatus(): StoryReelImageProviderStatus {
  const enabledFlag = process.env.MUSE_STORY_REEL_IMAGE_PROVIDER_ENABLED === 'true'
  const provider = providerKey()
  if (!enabledFlag || provider === 'none') {
    return {
      enabled: false,
      provider: 'none',
      reason: 'disabled-by-default',
      estimatedAiAttemptsPerImage: 0,
      userDailyCap: storyReelUserDailyCaps().image
    }
  }
  return {
    enabled: provider === 'mock',
    provider,
    reason: provider === 'mock' ? 'mock-provider-enabled' : 'unsupported-provider',
    estimatedAiAttemptsPerImage: 1,
    userDailyCap: storyReelUserDailyCaps().image
  }
}

function mockProviderImage(source: StoryReelSource, moment: StoryReelMoment, theme: StoryReelTheme, index: number, total: number): StoryReelProviderImage {
  const scene = source.scenes.find(entry => entry.index === moment.scene)
  const motif = suggestStoryMotif(source.title, `${moment.caption} ${moment.prompt}`)
  const svg = createStoryMomentSvg({
    title: source.title,
    passage: moment.caption,
    reflection: '',
    milestone: 'Story reel moment',
    progress: `${index + 1}/${total}`,
    theme,
    format: 'story',
    rtl: storyLanguage(source.language).dir === 'rtl',
    motif
  })
  const suffix = scene?.title ? ` ${scene.title}` : ''
  return {
    id: moment.id,
    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace('</svg>', `<desc>${moment.prompt}${suffix}</desc></svg>`))}`,
    provider: 'mock-image-provider'
  }
}

export async function generateStoryReelProviderImages(
  accountId: string,
  source: StoryReelSource,
  moments: StoryReelMoment[],
  theme: StoryReelTheme
): Promise<StoryReelProviderImage[]> {
  const status = storyReelImageProviderStatus()
  if (!status.enabled || status.provider !== 'mock') {
    throw new SharedStoryError('Story-reel image generation is disabled. Render with local artwork instead.', 503)
  }
  const images: StoryReelProviderImage[] = []
  for (let index = 0; index < moments.length; index++) {
    await reserveStoryReelImageAttempt(accountId)
    images.push(mockProviderImage(source, moments[index], theme, index, moments.length))
  }
  return images
}

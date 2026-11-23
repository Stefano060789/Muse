import type { PersonalStory } from '../lib/story'
import type { StoryLanguageCode } from '../lib/storyLanguage'
import HeygenStoryReel from './HeygenStoryReel'

type ReelStory = Pick<PersonalStory, 'id' | 'title' | 'scenes' | 'responses' | 'currentStep' | 'journey'>

export default function StoryReelComposer({ story, interfaceLanguage }: {
  story: ReelStory
  interfaceLanguage: StoryLanguageCode
}) {
  const canCreate = story.journey?.status === 'concluded' && !story.journey.pending
  return <HeygenStoryReel story={story} interfaceLanguage={interfaceLanguage} canCreate={canCreate} />
}

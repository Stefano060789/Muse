import type { PersonalStory } from '../lib/story'
import type { StoryLanguageCode } from '../lib/storyLanguage'
import HeygenStoryReel from './HeygenStoryReel'

type ReelStory = Pick<PersonalStory, 'id' | 'title' | 'scenes' | 'responses' | 'currentStep'>

export default function StoryReelComposer({ story, interfaceLanguage }: {
  story: ReelStory
  interfaceLanguage: StoryLanguageCode
}) {
  return <HeygenStoryReel story={story} interfaceLanguage={interfaceLanguage} />
}

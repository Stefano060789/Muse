import { billingCopy, type BillingCopy } from './billingCopy'
import type { StoryLanguageCode } from './storyLanguage'

const plans = [
  { id: 'free', price: 0, prefix: 'free', availability: 'free', features: ['sampleFeature', 'receiveFeature', 'savedFeature', 'audioFeature'] },
  { id: 'trial', price: 0, prefix: 'trial', availability: 'trial', features: ['trialStories', 'trialInteractions', 'personalFeature', 'giftFeature', 'audioFeature'] },
  { id: 'gift', price: 5.99, prefix: 'gift', availability: 'planned', features: ['longStory', 'longInteractions', 'giftFeature', 'audioFeature'] },
  { id: 'monthly', price: 8.99, prefix: 'monthly', availability: 'monthly', features: ['monthlyStories', 'monthlyInteractions', 'personalFeature', 'giftFeature', 'audioFeature'] },
  { id: 'annual', price: 89.99, prefix: 'annual', availability: 'planned', features: ['monthlyStories', 'monthlyInteractions', 'monthlyRefresh', 'personalFeature', 'giftFeature', 'audioFeature'] }
] as const satisfies readonly {
  id: string; price: number; prefix: 'free' | 'trial' | 'gift' | 'monthly' | 'annual'
  availability: 'free' | 'trial' | 'monthly' | 'planned'; features: readonly (keyof BillingCopy)[]
}[]

export function localizedBillingPlans(language: StoryLanguageCode) {
  const copy = billingCopy(language)
  const price = new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' })
  return plans.map(plan => ({
    id: plan.id,
    price: price.format(plan.price),
    amount: plan.price,
    availability: plan.availability,
    name: copy[`${plan.prefix}Name`],
    period: copy[`${plan.prefix}Period`],
    description: copy[`${plan.prefix}Description`],
    features: plan.features.map(key => copy[key])
  }))
}

export const BILLING_PLANS = localizedBillingPlans('en-US')

export const BILLING_PLANS = [
  {
    id: 'free', name: 'Free', price: '€0', period: 'No subscription',
    description: 'Enjoy stories people send you and explore the handcrafted sample.',
    features: [
      'Unlimited handcrafted sample replay',
      'Receive and complete gifts without paying',
      'Read or listen with browser narration and all local immersive soundscapes',
      'Existing stories stay available after a trial or subscription ends'
    ]
  },
  {
    id: 'trial', name: 'Muse Plus — 1 month free', price: '€0', period: '30 days, no card',
    description: 'Try the complete story-making experience. The trial starts when you create your Muse account; it does not renew or charge automatically.',
    features: [
      '10 story creations during the 30-day trial',
      '120 AI interactions during the 30-day trial',
      'No payment details collected; choose to subscribe after the trial',
      'All current Muse Plus benefits, browser narration and all local immersive soundscapes'
    ]
  },
  {
    id: 'gift', name: 'One-off Long Gift', price: '€5.99', period: 'One payment per gift',
    description: 'A longer, shared adventure made for a special occasion.',
    features: [
      '1 new 20-minute gift story, with 9 prepared scenes',
      'Optional live mode: up to 60 AI interactions, all available in one playthrough (planned limit)',
      'Dedication, photo/video and your recorded voice',
      'Optional private replies and printable keepsake',
      'Browser narration, all local immersive soundscapes and all seven story languages'
    ]
  },
  {
    id: 'monthly', name: 'Muse Plus', price: '€8.99', period: 'Per month',
    description: 'Keep personal stories growing and make meaningful experiences for people you care about.',
    features: [
      '10 new stories per billing month, personal or gifts',
      '120 AI interactions per billing month, shared across stories',
      'Continue completed personal stories with new chapters',
      'Choose memories as personal touches and edit or remove them anytime',
      'Optional story puzzles with hints and a skip that never blocks the ending (planned)',
      'Turn-taking stories for two on one device (planned for Plus)',
      'All local immersive soundscapes and browser narration; premium AI narration is not included',
      'All current gifting extras and seven story languages',
      'Additional Long Gifts proposed at €5.99 each'
    ]
  },
  {
    id: 'annual', name: 'Muse Plus Annual', price: '€89.99', period: 'Per year, billed once',
    description: 'The same Plus allowance, with annual savings.',
    features: [
      '10 new stories and 120 AI interactions each billing month',
      'Allowances refresh monthly, not all at once',
      'Same chapter, memory, puzzle and shared-story proposal as monthly Plus',
      'All local immersive soundscapes and browser narration',
      'Premium AI narration is not included',
      'Save €17.89 compared with 12 monthly payments',
      'Planned for later, after the monthly launch'
    ]
  }
] as const

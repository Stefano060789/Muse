export const BILLING_PLANS = [
  {
    id: 'free', name: 'Free', price: '€0', period: 'No subscription',
    description: 'Try Muse and enjoy stories someone sends you.',
    features: [
      'Unlimited handcrafted sample replay',
      'Receive and complete gifts without paying',
      'Browser narration and recipient language support',
      'No recurring AI creation allowance; generated trial to be decided'
    ]
  },
  {
    id: 'gift', name: 'One-off Gift', price: '€3.99', period: 'One payment per gift',
    description: 'A thoughtful adventure for a birthday or a little surprise.',
    features: [
      '1 new gift, approximately 5, 10, 15 or 20 minutes',
      'Optional live mode: up to 12 AI actions total across recipients',
      'Dedication, photo/video and your recorded voice',
      'Optional private replies and printable keepsake',
      'Browser narration and all five story languages'
    ]
  },
  {
    id: 'monthly', name: 'Muse Plus', price: '€8.99', period: 'Per month',
    description: 'Make personal stories and gifts more often.',
    features: [
      '10 new stories per billing month, personal or gifts',
      '120 AI interactions per billing month, shared across stories',
      'Personal journeys: up to 3, 6, 9 or 12 responses by length',
      'All current gifting extras, browser narration and five languages',
      'Additional gifts proposed at €3.99 each'
    ]
  },
  {
    id: 'annual', name: 'Muse Plus Annual', price: '€89.99', period: 'Per year, billed once',
    description: 'The same Plus allowance, with annual savings.',
    features: [
      '10 new stories and 120 AI interactions each billing month',
      'Allowances refresh monthly, not all at once',
      'Same features as monthly Plus',
      'Save €17.89 compared with 12 monthly payments',
      'Planned for later, after the monthly launch'
    ]
  }
] as const

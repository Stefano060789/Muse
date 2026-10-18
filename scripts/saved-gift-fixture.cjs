module.exports = {
  ownerToken: 'synthetic-owner-token',
  playToken: 'synthetic-recipient-token',
  expiresAt: null,
  brief: {
    language: 'en-US',
    creatorName: 'Avery',
    recipientName: 'Riley',
    narration: 'Warm and playful.',
    setting: 'A tiny bookshop after closing.',
    recipientHints: 'A favourite blue notebook.',
    goal: 'Find the birthday letter.',
    solution: 'blue notebook',
    message: 'Happy birthday, Riley!',
    durationMinutes: 5,
    gift: {
      occasion: 'birthday',
      dedication: 'A little adventure, just for you.',
      allowReply: true
    }
  },
  content: {
    title: 'The After-Hours Bookshop',
    description: 'Follow the clues to find a birthday surprise.',
    narrationStyle: 'warm',
    narrationLanguage: 'en-US',
    scenes: [{
      title: 'The Bell',
      body: 'A tiny bell rings from the back of the bookshop.',
      clue: 'Look where blue covers are kept.'
    }]
  }
}

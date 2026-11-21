const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(name) {
  const module = { exports: {} }
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', `${name}.ts`), 'utf8')
  new Function('module', 'exports', 'require', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText)(module, module.exports, id => load(id.replace('./', '')))
  return module.exports
}

const plan = load('journeyReelPlan')

const baseStory = {
  mood: 'curious',
  currentStep: 9,
  scenes: Array.from({ length: 10 }, (_, index) => ({
    title: `Scene ${index + 1}`,
    body: `Body ${index + 1}`,
    question: 'What now?',
    choices: ['Take a lantern', 'Open the gate', 'Look closer'],
    sceneMood: index % 2 ? 'mystery' : 'joy'
  })),
  responses: [
    'Take a lantern',
    'open the gate!',
    'A long free text answer that should switch choice display off by default.',
    'I changed direction in my own words.',
    'Take a lantern',
    'Open the gate',
    'Look closer',
    'Take a lantern',
    'Open the gate',
    'Look closer'
  ]
}

assert.equal(plan.truncateGraphemes('🌙✨🌊', 2), '🌙…')
assert.equal(plan.truncateGraphemes('  keep  spacing tidy  ', 20), 'keep spacing tidy')
assert.deepEqual(plan.evenlySampleIndices(12, 8), [0, 2, 3, 5, 6, 8, 9, 11])
assert.deepEqual(plan.evenlySampleIndices(3, 8), [0, 1, 2])
assert.equal(plan.journeyResponseKind('Open the gate!', ['open the gate']), 'choice')
assert.equal(plan.journeyResponseKind('I wrote my own answer', ['open the gate']), 'free')
assert.equal(plan.journeyResponseKind('   ', ['open the gate']), 'none')

const draft = plan.planJourneyReelDraft(baseStory)
assert.equal(draft.cards.length, plan.JOURNEY_REEL_MAX_SCENES)
assert.equal(draft.cards[0].sceneNumber, 1)
assert.equal(draft.cards.at(-1).sceneNumber, 10)
assert.equal(draft.defaultShowChoices, false, 'Free-text responses start with choices hidden')
assert.ok(draft.cards.every(card => card.choiceText.length <= plan.JOURNEY_REEL_CHOICE_LIMIT + 1))

const hidden = draft.cards.map((card, index) => index === 0 ? { ...card, hidden: true } : card)
const withoutChoices = plan.applyJourneyReelVisibility(hidden, false)
assert.equal(withoutChoices.length, draft.cards.length - 1)
assert.ok(withoutChoices.every(card => card.choiceLine === null), 'Choice text stays hidden when toggle is off')

const withChoices = plan.applyJourneyReelVisibility(hidden, true)
assert.ok(withChoices.every(card => card.hidden === false))
assert.ok(withChoices.some(card => card.choiceLine), 'Visible cards include choice text when toggle is on')
assert.equal(plan.journeyReelConsentRequired(hidden, false), false)
assert.equal(plan.journeyReelConsentRequired(hidden, true), true)

const shortTiming = plan.journeyReelTiming(2)
assert.ok(shortTiming.totalSeconds >= 15 && shortTiming.totalSeconds <= 30)
const longTiming = plan.journeyReelTiming(8)
assert.ok(longTiming.totalSeconds >= 15 && longTiming.totalSeconds <= 30)
assert.ok(longTiming.sceneSeconds > 0)

console.log('PASS journey reel planning, truncation, sampling, visibility, consent, and timing rules')

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const modules = new Map()
function load(file) {
  file = path.normalize(file)
  if (modules.has(file)) return modules.get(file).exports
  const result = { exports: {} }
  modules.set(file, result)
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  new Function('module', 'exports', 'require', code)(result, result.exports, id => id.startsWith('.') ? load(path.join(path.dirname(file), id + '.ts')) : require(id))
  return result.exports
}
const { togetherStoryBrief, togetherStoryCopy } = load('src/lib/togetherStory.ts')
const { parseSharedStoryBrief } = load('src/lib/sharedStory.ts')
const { parseGiftDraft } = load('src/lib/storyGift.ts')
for (const language of ['en-US', 'it-IT', 'es-ES', 'zh-CN', 'hi-IN', 'uk-UA', 'ar-SA']) {
  const original = {
    creatorName: 'Alex', recipientName: 'Sam', recipientHints: 'Our garden memory', language,
    message: '', setting: 'Old setting', goal: 'Old goal', solution: 'Old secret', narration: 'Old narration',
    durationMinutes: 20, romance: 'spicy', adventure: { actionBudget: 100, turnTaking: true },
    gift: { occasion: 'birthday', dedication: 'A personal note', allowReply: false }
  }
  const snapshot = JSON.stringify(original)
  const brief = togetherStoryBrief(original)
  assert.equal(JSON.stringify(original), snapshot, 'Applying a preset never mutates the previous brief')
  assert.equal(brief.durationMinutes, 5)
  assert.equal(brief.language, language)
  assert.equal(brief.recipientHints, original.recipientHints)
  assert.equal(brief.gift.dedication, original.gift.dedication)
  assert.equal(brief.romance, undefined)
  assert.equal(brief.adventure.turnTaking, undefined)
  assert.deepEqual(brief.adventure, { actionBudget: 6, choiceMode: 'suggested', cooperative: true })
  assert.equal(brief.unlockPolicy, 'allow-skip')
  assert.equal(brief.solution, togetherStoryCopy(language).solution)
  assert.equal(brief.message, togetherStoryCopy(language).defaultMessage)
  assert.equal(parseSharedStoryBrief(brief).durationMinutes, 5)
  assert.equal(parseGiftDraft({ version: 1, brief, assistanceHintsText: '', alternativeAnswersText: '', savedAt: new Date().toISOString() }).brief.adventure.cooperative, true)
  assert.equal(togetherStoryBrief({ ...original, message: 'My own words' }).message, 'My own words')
  assert.ok(Object.values(togetherStoryCopy(language)).every(text => typeof text === 'string' && text.trim()))
}
console.log('PASS seven-locale together-story presets, exact budgets, existing backend/draft contracts and preserved personal inputs')

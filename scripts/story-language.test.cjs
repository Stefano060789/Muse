const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { randomUUID, randomBytes } = require('node:crypto')

const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.story-language-tests-'))
const original = { env: { ...process.env }, fetch: global.fetch }
let passed = 0, calls = 0, response, request
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`) }
const narration = Array(100).fill('lantern').join(' ')
const state = { inventory: ['lantern'], discoveries: ['garden'], relationships: ['guide'], progress: 'A new path opens.' }
const turn = { narration, state, concluded: false }
const opening = code => ({
  title: 'A garden', description: 'A quiet exploration.', narrationStyle: 'warm', narrationLanguage: code,
  plan: ['Enter the garden', 'Explore with a guide', 'Return with a memory'], turn
})
const brief = {
  creatorName: 'Alex', recipientName: 'Sam', narration: 'Warm', setting: 'A garden',
  recipientHints: '', goal: 'Find a letter', solution: 'hidden private answer',
  message: 'a private surprise message', durationMinutes: 5
}
const sharedContent = code => ({
  title: 'A garden', description: 'A quiet exploration.', narrationStyle: 'warm', narrationLanguage: code,
  scenes: Array.from({ length: 3 }, () => ({ title: 'A gate', body: narration, clue: 'Follow the light.' }))
})
const personalContent = code => ({
  title: 'A garden', description: 'A quiet exploration.', narrationStyle: 'warm', narrationLanguage: code,
  scenes: Array.from({ length: 3 }, () => ({ title: 'A gate', body: narration, question: 'Where next?', choices: ['Gate', 'Path', 'Garden'] }))
})

async function main() {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/storyLanguage.ts', 'src/lib/sharedStoryGenerator.ts', 'src/lib/personalStoryGenerator.ts',
    'src/lib/personalJourney.ts', 'src/lib/sharedAdventure.ts', 'src/lib/storyLibrary.ts',
    'src/pages/api/personal-story.ts',
    '--outDir', output, '--strict', '--module', 'commonjs', '--target', 'es2020',
    '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })
  process.env.LLM_PROVIDER = 'GROQ'
  process.env.LLM_API_KEY = 'local-mock-language-fixture'
  process.env.STORY_STORAGE = 'sqlite'
  process.env.MUSE_SQLITE_PATH = path.join(output, 'stories.sqlite')
  process.env.MUSE_OPERATIONS_SQLITE_PATH = path.join(output, 'operations.sqlite')
  process.env.MUSE_CREATOR_ACCESS_CODE = 'local-language-fixture'
  process.env.MUSE_ADVENTURE_DAILY_ACTION_CAP = '1000'
  delete process.env.VERCEL
  global.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.groq.com/openai/v1/chat/completions')
    calls++
    request = JSON.parse(options.body)
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(response) } }] }), { status: 200 })
  }
  const language = require(path.join(output, 'lib', 'storyLanguage.js'))
  const shared = require(path.join(output, 'lib', 'sharedStory.js'))
  const { generateSharedStory } = require(path.join(output, 'lib', 'sharedStoryGenerator.js'))
  const personal = require(path.join(output, 'lib', 'personalStoryGenerator.js'))
  const journey = require(path.join(output, 'lib', 'personalJourney.js'))
  const adventure = require(path.join(output, 'lib', 'sharedAdventure.js'))
  const library = require(path.join(output, 'lib', 'storyLibrary.js'))
  const { storyRepository } = require(path.join(output, 'lib', 'storyRepository.js'))
  const handler = require(path.join(output, 'pages', 'api', 'personal-story.js')).default
  const codes = language.STORY_LANGUAGES.map(item => item.code)
  const promptIncludes = code => {
    assert.match(request.messages[0].content, new RegExp(`authoritative story language.*${code}`))
    assert.match(request.messages[0].content, /choice.*state metadata/)
  }
  await check('browser-safe catalog has all five complete recipient label sets and scoped Arabic direction', () => {
    assert.deepEqual(codes, ['en-US', 'zh-CN', 'hi-IN', 'es-ES', 'ar-SA'])
    assert.equal(language.storyLanguage().code, 'en-US')
    assert.equal(language.storyLanguage('ar-SA').dir, 'rtl')
    const keys = Object.keys(language.recipientCopy()).sort()
    const requiredLabels = [
      'madeForYou', 'openStory', 'noAccount', 'read', 'listen', 'tapPlay', 'answer', 'tryAnswer',
      'next', 'needHelp', 'hint', 'skip', 'solved', 'skipped', 'surprise', 'reply', 'replyLabel',
      'sendReply', 'updateReply', 'replySent', 'makeStory', 'clue', 'earlier', 'playScene',
      'playMessage', 'loadVoice', 'reloadVoice', 'voiceTitle', 'pauseHelp', 'skipHelp',
      'solveHelp', 'guessHelp', 'hintTitle', 'showHint', 'skipConfirm', 'dictateAction'
    ]
    for (const code of codes) {
      const copy = language.recipientCopy(code)
      assert.deepEqual(Object.keys(copy).sort(), keys)
      assert.ok(Object.entries(copy).every(([key, value]) => key === 'adventureStateLabels' || typeof value === 'function' || (typeof value === 'string' && value.trim())))
      for (const key of requiredLabels) assert.equal(typeof copy[key], 'string', `${code}: ${key}`)
      assert.ok(copy.forYou('Sam').includes('Sam'))
      assert.ok(copy.from('Sam').includes('Sam'))
      assert.ok(copy.duration(10).includes('10'))
      assert.ok(copy.replyPrivacy('Sam').includes('Sam'))
      assert.ok(copy.scene(1, 3).includes('1') && copy.scene(1, 3).includes('3'))
      assert.ok(copy.hintRemaining(2).includes('2'))
      assert.ok(copy.storyFrom('Alex', 'Sam').includes('Alex') && copy.storyFrom('Alex', 'Sam').includes('Sam'))
      assert.ok(copy.contactSender('Sam').includes('Sam'))
      assert.match(copy.adventureBudget(4, 8, 10), /4.*8.*10/)
      assert.deepEqual(Object.keys(copy.adventureStateLabels).sort(), ['discoveries', 'inventory', 'relationships'])
      assert.ok(Object.values(copy.adventureStateLabels).every(value => typeof value === 'string' && value.trim()))
      for (const key of ['reviewGuess', 'hintsNoCost', 'hintsExhausted', 'aiActionConsent', 'yourAction', 'continueAdventure', 'refreshProgress', 'noActions', 'noBudget', 'revealLoading', 'revealError', 'retry', 'surprisePhoto', 'surpriseVideo']) {
        assert.equal(typeof copy[key], 'string', `${code}: ${key}`)
      }
      assert.equal(language.parseStoryLanguage(code), code)
    }
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'src', 'lib', 'storyLanguage.ts'), 'utf8'), /from ['"](?:crypto|fs|path|node:)/)
  })
  await check('strict optional language parsing rejects null, aliases and arbitrary input without rewriting legacy defaults', () => {
    assert.equal(language.parseStoryLanguage(undefined), undefined)
    assert.ok(!Object.hasOwn(shared.parseSharedStoryBrief(brief), 'language'))
    assert.ok(!Object.hasOwn(personal.parsePersonalStoryRequest({ action: 'create', mood: 'curious', need: '', profileKeypoints: [] }), 'language'))
    for (const invalid of [null, '', 'en', 'en-us', 'fr-FR', 'zh-TW', 1, {}, ['en-US']]) {
      assert.throws(() => shared.parseSharedStoryBrief({ ...brief, language: invalid }))
      assert.throws(() => personal.parsePersonalStoryRequest({ action: 'create', mood: 'curious', need: '', profileKeypoints: [], language: invalid }))
      assert.throws(() => journey.parseJourneyInput({ duration: 5, mood: 'curious', need: '', profileKeypoints: [], language: invalid }))
    }
  })
  await check('deterministic right, wrong and skip feedback localizes only explicit language without translating arbitrary errors', () => {
    const outcomes = [
      ['You solved it.', 'feedbackSolved', { current_scene: 2, solved: true }],
      ['Not quite. Explore the clues and try again.', 'feedbackWrong', { current_scene: 0, solved: false }],
      ['Revealed without solving', 'feedbackSkipped', { current_scene: 0, solved: false, skipped: true }]
    ]
    for (const code of codes) {
      for (const [feedback, key, state] of outcomes) {
        assert.equal(shared.sharedStoryPlayerView({ ...brief, language: code }, sharedContent(code), state, feedback).feedback, language.recipientCopy(code)[key])
        assert.equal(shared.sharedStoryPlayerView(brief, sharedContent(code), state, feedback).feedback, feedback)
      }
      const state = { current_scene: 1, solved: false, revealed_hints: 1 }
      assert.ok(!Object.hasOwn(shared.sharedStoryPlayerView({ ...brief, language: code }, sharedContent(code), state), 'feedback'), 'Hint and next outcomes do not invent feedback')
      const unknown = 'Provider unavailable: original arbitrary error.'
      assert.equal(shared.sharedStoryPlayerView({ ...brief, language: code }, sharedContent(code), state, unknown).feedback, unknown)
    }
  })
  await check('all five shared and legacy personal languages persist and appear in one-call prompts', async () => {
    for (const code of codes) {
      const parsed = shared.parseSharedStoryBrief({ ...brief, language: code })
      response = sharedContent(code)
      const content = await generateSharedStory(parsed)
      promptIncludes(code)
      assert.equal(JSON.parse(request.messages[1].content).language, code)
      const player = shared.sharedStoryPlayerView(parsed, content, { current_scene: 0, solved: false })
      assert.equal(player.language, code)
      assert.ok(!Object.hasOwn(player, 'solution'))
      const creator = library.validateCreatorStory({ ownerToken: 'owner', brief: parsed, content, expiresAt: new Date().toISOString() })
      assert.equal(creator.brief.language, code)
      const input = personal.parsePersonalStoryRequest({ action: 'create', mood: 'curious', need: 'English input', profileKeypoints: [], language: code })
      response = personalContent(code)
      const story = await personal.generatePersonalStory(input)
      promptIncludes(code)
      assert.equal(story.language, code)
      assert.equal(library.validatePersonalStory(JSON.parse(JSON.stringify(story))).language, code)
      response = { narrationStyle: 'warm', narrationLanguage: code, scene: story.scenes[1] }
      const continuation = personal.parsePersonalStoryRequest({ action: 'continue', language: 'ar-SA', story, answer: 'English answer' })
      const continued = await personal.generatePersonalStory(continuation)
      promptIncludes(code)
      assert.equal(continued.language, code)
      assert.equal(continued.narrationLanguage, code)
    }
  })
  await check('explicit missing/wrong narration language fails once, while absent language preserves inference', async () => {
    for (const value of [undefined, 'fr-FR', 'en-US']) {
      const before = calls
      response = sharedContent(value)
      await assert.rejects(generateSharedStory({ ...brief, language: 'es-ES' }), error => error.status === 502 && /selected story language/.test(error.message))
      assert.equal(calls, before + 1)
      response = personalContent(value)
      await assert.rejects(personal.generatePersonalStory(personal.parsePersonalStoryRequest({ action: 'create', mood: 'curious', need: '', profileKeypoints: [], language: 'es-ES' })), error => error.status === 502)
      assert.equal(calls, before + 2)
    }
    response = sharedContent('fr-FR')
    assert.equal((await generateSharedStory(brief)).narrationLanguage, 'fr-FR')
    assert.ok(!Object.hasOwn(shared.sharedStoryPlayerView(brief, response, { current_scene: 0, solved: false }), 'language'))
    const legacy = { id: 'old', createdAt: new Date().toISOString(), mood: 'curious', currentStep: 0, responses: [], ...personalContent('fr-FR') }
    assert.ok(!Object.hasOwn(library.validatePersonalStory(legacy), 'language'))
    assert.throws(() => library.validatePersonalStory({ ...legacy, language: null }))
    assert.throws(() => library.validatePersonalStory({ ...legacy, language: 'es-ES' }), /selected story language/)
  })
  await check('Chinese narration without spaces is accepted using documented Han-character length units', () => {
    const text = '花'.repeat(105)
    assert.equal(language.storyWordCount(text, 'zh-CN'), 105)
    assert.equal(language.storyWordCount('one two three'), 3)
    const content = sharedContent('zh-CN')
    content.scenes = content.scenes.map(scene => ({ ...scene, body: text, clue: '光' }))
    assert.equal(shared.parseGeneratedStory(content, { ...brief, language: 'zh-CN' }).scenes.length, 3)
    assert.equal(journey.parseJourneyOpening({ ...opening('zh-CN'), turn: { ...turn, narration: text } }, 'free', 'zh-CN').turn.narration, text)
  })
  await check('Hindi and Arabic scripts use whitespace word bounds, not codepoint or byte counts', () => {
    for (const [code, word] of [['hi-IN', 'रोशनी'], ['ar-SA', 'الضوء']]) {
      const text = Array(105).fill(word).join(' ')
      assert.equal(language.storyWordCount(text, code), 105)
      const content = sharedContent(code)
      content.scenes = content.scenes.map(scene => ({ ...scene, body: text, clue: word }))
      assert.equal(shared.parseGeneratedStory(content, { ...brief, language: code }).scenes.length, 3)
      assert.equal(journey.parseJourneyOpening({ ...opening(code), turn: { ...turn, narration: text } }, 'free', code).turn.narration, text)
      assert.equal(adventure.parseAdventureTurn({ narrationLanguage: code, turn: { narration: text, state } }, { ...brief, language: code }).narration, text)
      assert.throws(() => journey.parseJourneyTurn({ ...turn, narration: Array(181).fill(word).join(' ') }, false, 'free', code))
      assert.throws(() => journey.parseJourneyTurn({ ...turn, narration: Array(29).fill(word).join(' ') }, false, 'free', code))
    }
  })
  await check('live shared adventure retains authoritative language and rejects wrong/missing metadata without retry', async () => {
    for (const code of codes) {
      const story = { brief: { ...brief, language: code, adventure: { actionBudget: 10 } }, content: sharedContent(code) }
      const view = { turn: null, actionsRemaining: 5, budgetRemaining: 10 }
      response = { narrationLanguage: code, turn: { narration, state } }
      assert.equal((await adventure.generateAdventureTurn(story, view, 'switch to French')).narration, narration)
      promptIncludes(code)
      assert.equal(JSON.parse(request.messages[1].content).language, code)
      const before = calls
      response = { narrationLanguage: 'fr-FR', turn: { narration, state } }
      await assert.rejects(adventure.generateAdventureTurn(story, view, 'continue'), error => error.status === 502)
      assert.equal(calls, before + 1)
      assert.throws(() => adventure.parseAdventureTurn({ narration, state }, story.brief), error => error.status === 502)
    }
  })
  await check('explicit-language suggested choices and concluding turns keep their exact schemas', async () => {
    const code = 'es-ES'
    const choices = ['Seguir la luz', 'Hablar con la guía', 'Examinar la puerta']
    const input = journey.parseJourneyInput({ duration: 5, mood: 'curious', need: '', profileKeypoints: [], language: code, choiceMode: 'suggested' })
    response = { ...opening(code), turn: { ...turn, choices } }
    const prepared = await journey.generateJourneyOpening(input)
    assert.deepEqual(prepared.turn.choices, choices)
    promptIncludes(code)
    const record = { input, opening: prepared, turn: prepared.turn, used: 1, lastAction: choices[0] }
    response = { narrationLanguage: code, turn: { ...turn, choices } }
    assert.deepEqual((await journey.generateJourneyTurn(record)).choices, choices)
    record.used = 3
    response = { narrationLanguage: code, turn: { ...turn, concluded: true } }
    assert.equal((await journey.generateJourneyTurn(record)).concluded, true)
    assert.ok(!Object.hasOwn((await journey.generateJourneyTurn(record)), 'choices'))
    const sharedBrief = { ...brief, language: code, adventure: { actionBudget: 10, choiceMode: 'suggested' } }
    response = { ...sharedContent(code), scenes: sharedContent(code).scenes.map(scene => ({ ...scene, choices })) }
    assert.deepEqual((await generateSharedStory(sharedBrief)).scenes[0].choices, choices)
    const story = { brief: sharedBrief, content: sharedContent(code) }
    response = { narrationLanguage: code, turn: { narration, state, choices } }
    assert.deepEqual((await adventure.generateAdventureTurn(story, { actionsRemaining: 4, budgetRemaining: 10 }, choices[0])).choices, choices)
    response = { narrationLanguage: code, turn: { narration, state } }
    assert.ok(!Object.hasOwn((await adventure.generateAdventureTurn(story, { actionsRemaining: 0, budgetRemaining: 10 }, choices[0])), 'choices'))
  })
  await check('legacy continuation and personal openings explicitly reject mismatched language metadata once', async () => {
    response = personalContent('hi-IN')
    const input = personal.parsePersonalStoryRequest({ action: 'create', mood: 'curious', need: '', profileKeypoints: [], language: 'hi-IN' })
    const story = await personal.generatePersonalStory(input)
    const continuation = personal.parsePersonalStoryRequest({ action: 'continue', story, answer: 'Continue' })
    response = { narrationLanguage: 'en-US', narrationStyle: 'warm', scene: story.scenes[1] }
    const before = calls
    await assert.rejects(personal.generatePersonalStory(continuation), error => error.status === 502)
    assert.equal(calls, before + 1)
    response = opening('en-US')
    await assert.rejects(journey.generateJourneyOpening({ mood: 'curious', need: '', profileKeypoints: [], duration: 5, language: 'ar-SA' }), error => error.status === 502)
    assert.equal(calls, before + 2)
  })
  let address = 0
  async function api(body) {
    const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this }, json(value) { this.body = value; return this } }
    await handler({ method: 'POST', headers: { host: 'localhost:3000', 'x-muse-creator-code': process.env.MUSE_CREATOR_ACCESS_CODE }, socket: { remoteAddress: `language-fixture-${++address}` }, body: { consentVersion: '2026-10-14', ...body } }, res)
    return res
  }
  await check('invalid explicit journey language is rejected before provider use or reservation', async () => {
    const before = calls
    const saved = { mode: 'journey', id: randomUUID(), capability: randomBytes(32).toString('hex') }
    const invalid = await api({ ...saved, action: 'create', duration: 5, mood: 'curious', need: '', profileKeypoints: [], language: 'fr-FR' })
    assert.equal(invalid.statusCode, 400)
    assert.equal(calls, before)
    await assert.rejects(storyRepository().personalJourney({ operation: 'view', id: saved.id, capabilityHash: journey.journeyHash(saved.capability), cap: 1000 }), error => error.status === 404)
  })
  await check('personal journey language survives SQL JSON, browser library, resume and forged continuation language', async () => {
    for (const code of codes) {
      const saved = { mode: 'journey', id: randomUUID(), capability: randomBytes(32).toString('hex') }
      response = opening(code)
      const created = await api({ ...saved, action: 'create', duration: 5, mood: 'curious', need: '', profileKeypoints: [], language: code })
      assert.equal(created.statusCode, 200, JSON.stringify(created.body))
      assert.equal(created.body.story.language, code)
      assert.equal(library.validatePersonalStory(created.body.story).language, code)
      const before = calls
      const resumed = await api({ ...saved, action: 'resume', language: 'fr-FR' })
      assert.equal(calls, before)
      assert.equal(resumed.body.story.language, code)
      response = { narrationLanguage: code, turn }
      const continued = await api({ ...saved, action: 'respond', revision: 0, requestId: randomUUID(), text: 'Use English now', language: 'en-US' })
      assert.equal(continued.statusCode, 200, JSON.stringify(continued.body))
      assert.equal(continued.body.story.language, code)
      assert.equal(continued.body.story.scenes[1].title, language.recipientCopy(code).scene(2, 2))
      promptIncludes(code)
      assert.equal(JSON.parse(request.messages[1].content).language, code)
      const record = (await storyRepository().personalJourney({ operation: 'view', id: saved.id, capabilityHash: journey.journeyHash(saved.capability), cap: 1000 })).record
      assert.equal(record.input.language, code)
    }
  })
  await check('failed personal journey language consumes one attempt and is not persisted as new narration', async () => {
    const saved = { mode: 'journey', id: randomUUID(), capability: randomBytes(32).toString('hex') }
    response = opening('ar-SA')
    assert.equal((await api({ ...saved, action: 'create', duration: 5, mood: 'curious', need: '', profileKeypoints: [], language: 'ar-SA' })).statusCode, 200)
    response = { narrationLanguage: 'en-US', turn }
    const before = calls
    const failed = await api({ ...saved, action: 'respond', revision: 0, requestId: randomUUID(), text: 'Continue' })
    assert.equal(failed.statusCode, 502)
    assert.equal(calls, before + 1)
    assert.equal(failed.body.story.language, 'ar-SA')
    assert.equal(failed.body.story.scenes.length, 1)
    assert.equal(failed.body.snapshot.revision, 1)
    assert.equal(failed.body.snapshot.pending, false)
  })
  await check('shared language persists in existing SQL JSON columns without schema changes', async () => {
    const db = storyRepository()
    const id = randomUUID()
    await db.insert({ id, owner_hash: 'owner', play_hash: 'play', brief: { ...brief, language: 'hi-IN' }, content: sharedContent('hi-IN'), answer_normalized: 'hidden private answer', expires_at: new Date(Date.now() + 86400000).toISOString() })
    const restored = await db.findUnexpired(id)
    assert.equal(restored.brief.language, 'hi-IN')
    assert.equal(shared.sharedStoryPlayerView(restored.brief, restored.content, { current_scene: 0, solved: false }).language, 'hi-IN')
  })
  console.log(`\n${passed} story language tests passed (mocked providers only; linguistic quality not assessed).`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  global.fetch = original.fetch
  process.env = original.env
  fs.rmSync(output, { recursive: true, force: true })
})

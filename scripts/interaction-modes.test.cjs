const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { randomUUID, randomBytes } = require('node:crypto')

const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.interaction-tests-'))
const original = { env: { ...process.env }, fetch: global.fetch }
let passed = 0, calls = 0, lastInput, invalidChoices = false
const choices = ['Inspect the lantern', 'Talk to the guide', 'Explore the courtyard']
const nextChoices = ['Follow the path', 'Examine the gate', 'Ask about the garden', 'Study the fountain', 'Rest by the wall']
const state = { inventory: [], discoveries: [], relationships: [], progress: 'The courtyard is open.' }
const narration = Array(60).fill('The lantern lights the courtyard as you explore the garden and notice something new.').join(' ').split(' ').slice(0, 100).join(' ')
const code = 'interaction-test-not-a-real-secret'
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`) }

async function main() {
  execFileSync(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/pages/api/personal-story.ts', 'src/pages/api/shared-story.ts',
    '--outDir', output, '--module', 'commonjs', '--target', 'es2020',
    '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'], { cwd: root, stdio: 'inherit' })
  Object.assign(process.env, {
    STORY_STORAGE: 'sqlite', MUSE_SQLITE_PATH: path.join(output, 'test.sqlite'),
    MUSE_MEDIA_PATH: path.join(output, 'media'), LLM_PROVIDER: 'GROQ',
    LLM_API_KEY: 'test-only', MUSE_CREATOR_ACCESS_CODE: code, MUSE_ADVENTURE_DAILY_ACTION_CAP: '1000'
  })
  delete process.env.VERCEL
  const personal = require(path.join(output, 'pages', 'api', 'personal-story.js')).default
  const shared = require(path.join(output, 'pages', 'api', 'shared-story.js')).default
  const helper = require(path.join(output, 'lib', 'freeformStory.js'))
  const journey = require(path.join(output, 'lib', 'personalJourney.js'))
  const adventure = require(path.join(output, 'lib', 'sharedAdventure.js'))
  const library = require(path.join(output, 'lib', 'storyLibrary.js'))
  const brief = {
    creatorName: 'Alex', recipientName: 'Sam', narration: 'Warm', setting: 'A courtyard with a lantern and garden.',
    recipientHints: '', goal: 'Find the hidden invitation.', solution: 'inside the copper teapot',
    message: 'Meet me at sunrise.', durationMinutes: 5, adventure: { actionBudget: 12, choiceMode: 'suggested' }
  }
  global.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.groq.com/openai/v1/chat/completions')
    calls++
    const payload = JSON.parse(options.body), input = JSON.parse(payload.messages[1].content)
    lastInput = input
    const suggested = payload.messages[0].content.includes('choices":["...')
    const concluding = input.responsesRemaining === 0 || input.actionsRemaining === 0
    const offered = invalidChoices ? ['Only one'] : input.action ? nextChoices : choices
    const turn = { narration, state, ...(suggested && !concluding ? { choices: offered } : {}) }
    let value
    if (input.creatorName) value = {
      title: 'The courtyard', description: 'Explore a welcoming garden.', narrationStyle: 'warm', narrationLanguage: 'en-US',
      scenes: Array.from({ length: 3 }, (_, i) => ({
        title: `Clue ${i + 1}`, body: Array(120).fill('wonder').join(' '), clue: 'Look where the light falls.',
        ...(input.adventure?.choiceMode === 'suggested' && i === 0 ? { choices: offered } : {})
      }))
    }
    else if (input.responsesRemaining === undefined && input.actionsRemaining === undefined) value = {
      title: 'The courtyard', description: 'Explore a welcoming garden.', plan: ['Enter the garden.', 'Explore together.', 'Bring the journey to a close.'],
      narrationStyle: 'warm', narrationLanguage: 'en-US', turn: { ...turn, concluded: false }
    }
    else value = input.responsesRemaining !== undefined ? { ...turn, concluded: concluding } : turn
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }), { status: 200 })
  }
  let client = 0
  async function api(handler, body) {
    const res = { statusCode: 200, setHeader() {}, status(status) { this.statusCode = status; return this }, json(body) { this.body = body; return this } }
    await handler({ method: 'POST', headers: { host: 'localhost', 'x-muse-creator-code': code }, socket: { remoteAddress: `fixture-${++client}` }, body: { consentVersion: '2026-10-14', ...body } }, res)
    return { status: res.statusCode, body: res.body }
  }
  const createPersonal = (duration, choiceMode = 'suggested') => api(personal, {
    mode: 'journey', action: 'create', id: randomUUID(), capability: randomBytes(32).toString('hex'),
    mood: 'curious', need: '', profileKeypoints: [], duration, choiceMode
  })
  const respond = (story, text, revision = story.journey.revision, requestId = randomUUID()) => ({
    mode: 'journey', action: 'respond', id: story.id, capability: story.journey.capability, text, revision, requestId
  })

  await check('suggestions require 3-5 distinct bounded actions and reject malformed mode', () => {
    for (const length of [3, 4, 5]) assert.equal(helper.parseSuggestedChoices(nextChoices.slice(0, length)).length, length)
    for (const value of [[], ['A', 'B'], [...nextChoices, 'Six'], ['A', 'a', 'B'], ['A', 'B', 'x'.repeat(161)]]) assert.throws(() => helper.parseSuggestedChoices(value))
    for (const mode of ['invalid', null, 1]) assert.throws(() => helper.parseStoryChoiceMode(mode))
    assert.throws(() => helper.validatePlayerChoiceSelection('suggested', choices, { text: 'Arbitrary action' }))
    assert.throws(() => helper.validatePlayerChoiceSelection('suggested', choices, { choiceIndex: 99 }))
    assert.equal(helper.validatePlayerChoiceSelection('free', undefined, { text: 'Do something different' }), 'Do something different')
  })
  for (const duration of [5, 10, 15, 20]) {
    await check(`personal suggested mode survives resume, enforces ${journey.JOURNEY_TURNS[duration]} responses and ends without choices`, async () => {
      let result = await createPersonal(duration)
      assert.equal(result.status, 200)
      let story = result.body.story
      assert.deepEqual(story.journey.choices, choices)
      const resumed = await api(personal, { mode: 'journey', action: 'resume', id: story.id, capability: story.journey.capability })
      assert.deepEqual(resumed.body.story.journey.choices, choices)
      assert.equal(library.validatePersonalStory(story).journey.choiceMode, 'suggested')
      const before = calls
      const forged = await api(personal, { ...respond(story, 'invented'), choiceMode: 'free' })
      assert.equal(forged.status, 400); assert.equal(calls, before)
      for (let i = 0; i < journey.JOURNEY_TURNS[duration]; i++) {
        const action = respond(story, story.journey.choices[0])
        const before = calls
        result = await api(personal, action)
        assert.equal(result.status, 200, JSON.stringify(result.body))
        assert.equal(lastInput.action, action.text)
        assert.equal(calls, before + 1)
        story = result.body.story
        assert.equal(story.mood, 'curious')
        const replay = await api(personal, action)
        assert.equal(replay.status, 200); assert.equal(calls, before + 1)
        assert.equal((await api(personal, { ...action, requestId: randomUUID() })).status, 409)
        if (story.journey.status === 'active') assert.equal(story.journey.choices.length, 5)
      }
      assert.equal(story.journey.status, 'concluded')
      assert.equal(story.journey.choices, undefined)
      assert.equal((await api(personal, respond(story, 'Another action'))).status, 400)
    })
  }
  await check('personal free mode keeps editable arbitrary actions and no menus', async () => {
    const created = await createPersonal(5, 'free')
    assert.equal(created.status, 200)
    assert.equal(created.body.story.journey.choiceMode, 'free')
    assert.equal(created.body.story.journey.choices, undefined)
    assert.equal((await api(personal, respond(created.body.story, 'I take a different path'))).status, 200)
  })
  await check('Supabase-style snapshots are enriched from the authoritative record without SQL changes', () => {
    const record = { input: { duration: 5, choiceMode: 'suggested' }, used: 0, turn: { narration, state, concluded: false, choices }, creationStatus: 'done', opening: null }
    const result = journey.publicJourney({ record, snapshot: { pending: false } }, 'unused')
    assert.deepEqual(result.snapshot.choices, choices)
    assert.equal(result.snapshot.choiceMode, 'suggested')
  })
  await check('shared suggestions adapt through all 12 actions, preserve replay and keep secrets private', async () => {
    const created = await api(shared, { action: 'create', brief })
    assert.equal(created.status, 201, JSON.stringify(created.body))
    const token = created.body.playToken
    const opened = await api(shared, { action: 'open', token })
    assert.equal(opened.status, 200)
    const sessionToken = opened.body.sessionToken
    let view = opened.body.player.adventure
    assert.deepEqual(view.choices, choices)
    const before = calls
    assert.equal((await api(shared, { action: 'adventure', token, sessionToken, revision: 0, requestId: randomUUID(), text: 'invented', choiceMode: 'free' })).status, 400)
    assert.equal(calls, before)
    for (let i = 0; i < 12; i++) {
      const action = { action: 'adventure', token, sessionToken, revision: view.revision, requestId: randomUUID(), text: view.choices[0] }
      const before = calls
      const next = await api(shared, action)
      assert.equal(next.status, 200, JSON.stringify(next.body))
      assert.equal(lastInput.action, action.text)
      for (const secret of [brief.solution, brief.message]) assert.ok(!JSON.stringify(lastInput).includes(secret))
      assert.equal(calls, before + 1)
      view = next.body.player.adventure
      assert.equal((await api(shared, action)).status, 200)
      assert.equal(calls, before + 1)
      assert.equal((await api(shared, { ...action, requestId: randomUUID() })).status, 409)
      if (i < 11) assert.equal(view.choices.length, 5)
    }
    assert.equal(view.actionsRemaining, 0)
    assert.equal(view.choices, undefined)
    const refreshed = await api(shared, { action: 'open', token, sessionToken })
    assert.equal(refreshed.body.player.adventure.choiceMode, 'suggested')
    assert.equal(refreshed.body.player.adventure.choices, undefined)
    assert.equal((await api(shared, { action: 'guess', token, sessionToken, guess: brief.solution })).body.player.solved, true)
  })
  await check('shared live choices validate privacy and exhausted views omit menus on either backend', () => {
    assert.throws(() => adventure.parseAdventureTurn({ narration, state, choices: [brief.solution, 'Investigate', 'Look around'] }, brief, 'suggested'), /privacy/)
    assert.throws(() => adventure.parseAdventureTurn({ narration, state, choices }, brief, 'free'))
    const view = { actionsRemaining: 12, budgetRemaining: 12, pending: false, turn: null }
    const story = { brief, content: { scenes: [{ choices }] } }
    assert.deepEqual(adventure.adventureChoiceView(view, story).choices, choices)
    assert.equal(adventure.adventureChoiceView({ ...view, budgetRemaining: 0 }, story).choices, undefined)
    assert.equal(adventure.adventureChoiceView({ ...view, pending: true }, story).choices, undefined)
  })
  await check('invalid AI suggestions consume one attempt without automatic regeneration', async () => {
    const created = await createPersonal(5)
    const action = respond(created.body.story, choices[0])
    invalidChoices = true
    const before = calls
    const failed = await api(personal, action)
    invalidChoices = false
    assert.equal(failed.status, 502)
    assert.equal(failed.body.story.journey.revision, 1)
    assert.equal(calls, before + 1)
    assert.equal((await api(personal, action)).body.status, 'failed')
    assert.equal(calls, before + 1)
  })
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  process.env = original.env
  global.fetch = original.fetch
  fs.rmSync(output, { recursive: true, force: true })
  if (!process.exitCode) console.log(`\n${passed} interaction-mode checks passed; no real AI requests.`)
})

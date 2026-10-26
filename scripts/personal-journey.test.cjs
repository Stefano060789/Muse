const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync, spawn } = require('node:child_process')
const { randomUUID, randomBytes } = require('node:crypto')
const { DatabaseSync } = require('node:sqlite')
const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.personal-journey-tests-'))
const original = { env: { ...process.env }, fetch: global.fetch, now: Date.now, window: global.window }
const filename = path.join(output, 'journeys.sqlite')
let now = Math.floor(Date.now() / 3600000) * 3600000 + 60000
let passed = 0, calls = 0, childCalls = 0, providerMode = 'ok', hold, received
let consentVersion
const requests = []
const state = { inventory: ['a lantern'], discoveries: ['a sheltered garden'], relationships: ['a welcoming gardener'], progress: 'You found a quiet place to explore.' }
const narration = 'You settle beside the sheltered garden and listen to the leaves move above you. The gardener notices your lantern and sets a small cup of tea on the wall. Nothing needs to be hurried here. You take a sip and remember the path you chose, noticing how its turns have brought you somewhere different without asking you to become someone else. The gate remains open, but for now this place is enough. The conversation feels easy, and the light gathers softly along the stone. You carry that warmth with you as the evening settles, glad for the little discoveries you made together.'
const conclusion = 'The gardener walks with you to the gate, and together you set the lantern on the wall where the next visitor can find it. Your final gesture changes the little garden: a place once empty now holds a welcome. The questions that brought you here do not need to become instructions for tomorrow. You have listened, explored, and helped someone feel less alone. As the evening settles, you thank your companion and close the gate gently. This chapter is complete, its discoveries and friendships woven into a quiet memory you can keep. The warmth of the garden stays with you as you head home.'
const opening = { title: 'The sheltered garden', description: 'An unhurried journey of small discoveries.', narrationStyle: 'warm', narrationLanguage: 'en-US', plan: ['Enter the sheltered garden.', 'Meet a gardener and explore freely.', 'Leave a welcome and bring the threads together.'], turn: { narration, state, concluded: false } }
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`) }
function inspect(run) {
  const db = new DatabaseSync(filename)
  try { return run(db) } finally { db.close() }
}
function dayUsed() { return inspect(db => Number(db.prepare('SELECT used FROM muse_adventure_budgets WHERE bucket = ?').get(`day:${new Date(now).toISOString().slice(0, 10)}`)?.used || 0)) }
function newCreation(duration = 5) {
  return { mode: 'journey', action: 'create', id: randomUUID(), capability: randomBytes(32).toString('hex'), duration, mood: 'relaxed', need: 'I am restless and want an adventure, but I explicitly chose relaxed.', profileKeypoints: ['I enjoy gardens.'] }
}
function responseBody(created, revision = created.snapshot.revision, requestId = randomUUID()) {
  return { mode: 'journey', action: 'respond', id: created.story.id, capability: created.story.journey.capability, revision, requestId, text: 'I thank the gardener and leave a light for the next visitor.' }
}
async function main() {
  execFileSync(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/pages/api/personal-story.ts', 'src/pages/api/shared-story.ts',
    '--outDir', output, '--module', 'commonjs', '--target', 'es2020', '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'], { cwd: root, stdio: 'inherit' })
  process.env.STORY_STORAGE = 'sqlite'; process.env.MUSE_SQLITE_PATH = filename
  process.env.LLM_PROVIDER = 'GROQ'; process.env.LLM_API_KEY = 'mock-journey-key'
  process.env.MUSE_ADVENTURE_DAILY_ACTION_CAP = '1000'
  delete process.env.VERCEL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  Date.now = () => now
  const handlerPath = path.join(output, 'pages', 'api', 'personal-story.js')
  const handler = require(handlerPath).default
  const { storyRepository } = require(path.join(output, 'lib', 'storyRepository.js'))
  const journey = require(path.join(output, 'lib', 'personalJourney.js'))
  consentVersion = require(path.join(output, 'lib', 'legalContact.js')).MUSE_AI_CONSENT_VERSION
  const library = require(path.join(output, 'lib', 'storyLibrary.js'))
  global.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.groq.com/openai/v1/chat/completions', 'No real network endpoint allowed')
    calls++
    const payload = JSON.parse(options.body)
    const input = JSON.parse(payload.messages[1].content)
    requests.push({ payload, input })
    if (received) { received(); received = null }
    if (hold) await hold
    if (providerMode === 'network') throw new Error('private-provider-error-with-secret')
    if (providerMode === 'status') return new Response('private-api-key', { status: 401 })
    let value
    if (providerMode === 'invalid') value = { ...opening.turn, private: 'secret' }
    else if (providerMode === 'legacy') value = { title: 'Legacy story', description: 'Old format still works.', narrationStyle: 'warm', narrationLanguage: 'en-US', scenes: Array.from({ length: 3 }, () => ({ title: 'Legacy', body: narration, question: 'Where next?', choices: ['A', 'B', 'C'] })) }
    else if (providerMode === 'legacy-continue') value = { narrationStyle: 'warm', narrationLanguage: 'en-US', scene: { title: 'Legacy continued', body: narration, question: 'Where next?', choices: ['A', 'B', 'C'] } }
    else value = input.responsesRemaining === undefined ? opening : {
      narration: input.responsesRemaining === 0 ? conclusion : narration, state, concluded: input.responsesRemaining === 0
    }
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }), { status: 200 })
  }
  let address = 0
  async function api(body, options = {}) {
    const headers = {}, res = {
      statusCode: 200, body: null, setHeader(name, value) { headers[name] = value },
      status(code) { this.statusCode = code; return this }, json(value) { this.body = value; return this }
    }
    await handler({ method: options.method || 'POST', headers: { host: 'localhost:3000', ...(options.origin ? { origin: options.origin } : {}) }, socket: { remoteAddress: options.address || `fixture-${++address}` }, body: { consentVersion, ...body } }, res)
    assert.equal(headers['Cache-Control'], 'no-store')
    return { status: res.statusCode, body: res.body }
  }
  const savedCreations = []
  await check('missing or stale processing consent blocks creation before any AI attempt', async () => {
    const before = calls
    for (const consentVersion of [undefined, null, 'old-version']) {
      assert.equal((await api({ ...newCreation(), consentVersion })).status, 400)
    }
    assert.equal(calls, before)
    assert.ok(!fs.existsSync(filename))
  })
  await check('every personal operation is gated, origin-protected and no-store before storage/provider access', async () => {
    const before = calls
    process.env.VERCEL = '1'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-rate-limit-key'
    for (const action of ['create', 'respond', 'resume']) {
      assert.equal((await api({ mode: 'journey', action }, { code: undefined })).status, 503)
      assert.equal((await api({ mode: 'journey', action }, { origin: 'https://hostile.example' })).status, 403)
    }
    delete process.env.VERCEL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    assert.equal((await api({}, { method: 'GET' })).status, 405)
    assert.equal(calls, before)
    assert.ok(!fs.existsSync(filename))
  })
  await check('creation validates all durations, mood, capabilities and bounded profile before any AI call', async () => {
    const before = calls
    for (const patch of [{ duration: 6 }, { duration: '5' }, { duration: null }, { mood: 'angry' }, { profileKeypoints: Array(6).fill('x') }, { need: 'x'.repeat(1001) }, { capability: 'x' }, { id: 'invalid' }]) {
      assert.equal((await api({ ...newCreation(), ...patch })).status, 400)
    }
    assert.equal(calls, before)
  })
  for (const duration of [5, 10, 15, 20]) {
    await check(`${duration} minutes locks ${duration * 3 / 5} responses, one opening+plan call and actual final conclusion`, async () => {
      const creation = newCreation(duration)
      const before = calls, beforeBudget = fs.existsSync(filename) ? dayUsed() : 0
      let result = await api({ ...creation, maxTurns: 999, plan: ['hacked'], state: { progress: 'hacked' } })
      assert.equal(result.status, 200)
      const initial = result.body
      savedCreations.push({ creation, initial })
      assert.equal(calls, before + 1)
      assert.equal(dayUsed(), beforeBudget, 'Opening uses existing generation limits, not live action budget')
      assert.equal(initial.story.mood, 'relaxed')
      assert.equal(initial.snapshot.maxTurns, duration * 3 / 5)
      assert.equal(initial.story.journey.capability, creation.capability)
      assert.equal(initial.story.scenes[0].choices.length, 0)
      const row = inspect(db => db.prepare('SELECT record, expires_at FROM muse_personal_journeys WHERE id = ?').get(creation.id))
      assert.ok(!row.record.includes(creation.capability), 'Database stores capability hash only')
      assert.equal(row.expires_at, 'infinity')
      assert.equal(JSON.parse(row.record).expiresAt, null)
      for (const sensitive of ['capabilityHash', '"plan"', '"opening"', 'mock-journey-key', 'owner_hash', 'answer_normalized']) assert.ok(!JSON.stringify(initial).includes(sensitive))
      for (let revision = 0; revision < duration * 3 / 5; revision++) {
        result = await api({ ...responseBody(result.body), duration: 20, mood: 'adventure', maxTurns: 999, profileKeypoints: ['INJECTED_PROFILE'], plan: ['INJECTED_PLAN'], state: { progress: 'INJECTED_STATE' } })
        assert.equal(result.status, 200)
        assert.equal(result.body.snapshot.revision, revision + 1)
        assert.equal(result.body.story.mood, 'relaxed')
        assert.equal(result.body.snapshot.duration, duration)
        const recent = requests.at(-1)
        assert.equal(recent.payload.max_tokens, 1600)
        assert.equal(recent.input.mood, 'relaxed')
        assert.deepEqual(recent.input.profileKeypoints, ['I enjoy gardens.'])
        assert.deepEqual(recent.input.plan, opening.plan)
        assert.ok(!JSON.stringify(recent.input).includes('INJECTED_'))
        assert.ok(!JSON.stringify(recent.input).includes(creation.capability))
        assert.ok(!('scenes' in recent.input) && !('responses' in recent.input), 'No growing transcript sent')
        assert.ok(recent.payload.messages[0].content.includes('selected mood is authoritative'))
        assert.equal(result.body.snapshot.status, revision + 1 === duration * 3 / 5 ? 'concluded' : 'active')
      }
      assert.equal(result.body.story.scenes.at(-1).title, 'The conclusion')
      assert.equal(result.body.story.scenes.at(-1).body, conclusion)
      assert.ok(requests.at(-1).payload.messages[0].content.includes('actual meaningful conclusion'))
      assert.equal(calls, before + 1 + duration * 3 / 5)
      assert.equal(dayUsed(), beforeBudget + duration * 3 / 5)
      const atCap = calls
      assert.equal((await api(responseBody(result.body))).status, 409)
      assert.equal((await api({ mode: 'journey', action: 'resume', id: creation.id, capability: creation.capability })).body.snapshot.status, 'concluded')
      assert.equal(calls, atCap)
    })
  }
  await check('account library restores personal journeys across browsers and isolates each account', async () => {
    const listed = await api({ mode: 'journey', action: 'library' })
    assert.equal(listed.status, 200)
    assert.deepEqual(new Set(listed.body.stories.map(story => story.id)), new Set(savedCreations.map(item => item.initial.story.id)))
    const restored = listed.body.stories[0]
    assert.notEqual(restored.journey.capability, savedCreations.find(item => item.initial.story.id === restored.id).creation.capability)
    const resumed = await api({ mode: 'journey', action: 'resume', id: restored.id, capability: restored.journey.capability })
    assert.equal(resumed.status, 200)
    assert.equal(resumed.body.story.id, restored.id)
    const repository = storyRepository()
    assert.deepEqual(await repository.listPersonalJourneys('another-account'), [])
    await assert.rejects(repository.personalJourney({
      operation: 'view', id: restored.id, accountId: 'another-account',
      capabilityHash: journey.journeyHash(restored.journey.capability), cap: 1000
    }), error => error.status === 404)
    assert.equal(await repository.deletePersonalJourney(restored.id, 'a'.repeat(64), 'another-account'), false)
    assert.equal((await repository.listPersonalJourneys('local-development')).length, savedCreations.length)
  })
  await check('creation replay, new repository and process restart never regenerate or reset allowance', async () => {
    const { creation, initial } = savedCreations[0]
    const before = calls
    const repeat = await api(creation)
    assert.equal(repeat.status, 200)
    assert.equal(repeat.body.snapshot.revision, 3)
    assert.equal(repeat.body.snapshot.status, 'concluded')
    assert.equal((await api({ ...creation, duration: 20 })).status, 409)
    const record = await storyRepository().personalJourney({ operation: 'view', id: creation.id, accountId: 'local-development', capabilityHash: journey.journeyHash(creation.capability), cap: 1000 })
    assert.equal(record.record.used, 3)
    const child = execFileSync(process.execPath, ['-e', `const r=require(${JSON.stringify(path.join(output, 'lib', 'storyRepository.js'))}).storyRepository();r.personalJourney(${JSON.stringify({ operation: 'view', id: creation.id, accountId: 'local-development', capabilityHash: journey.journeyHash(creation.capability), cap: 1000 })}).then(v=>console.log(JSON.stringify(v.snapshot)))`], { cwd: root, env: process.env, encoding: 'utf8' })
    assert.equal(JSON.parse(child.trim()).revision, 3)
    assert.equal(calls, before)
    assert.equal((await api({ mode: 'journey', action: 'resume', id: initial.story.id, capability: 'a'.repeat(64) })).status, 200,
      'The account owns the journey; its browser capability is not cross-account authorization')
  })
  let concurrency
  await check('atomic creation reservation blocks concurrent duplicates before paid generation', async () => {
    const creation = newCreation(10)
    let release, notify
    hold = new Promise(resolve => { release = resolve })
    const arrived = new Promise(resolve => { notify = resolve })
    received = notify
    const before = calls
    const pending = api(creation)
    await arrived
    const duplicate = await api(creation)
    assert.equal(duplicate.status, 200)
    assert.equal(duplicate.body.status, 'pending')
    assert.equal(duplicate.body.story, null)
    assert.equal(duplicate.body.snapshot.pending, true)
    assert.equal((await api({ ...creation, need: 'changed' })).status, 409)
    assert.equal(calls, before + 1)
    release(); hold = null
    concurrency = (await pending).body
  })
  await check('same/different-request concurrency and stale cross-tab submissions make at most one call', async () => {
    const action = responseBody(concurrency)
    let release, notify
    hold = new Promise(resolve => { release = resolve })
    const arrived = new Promise(resolve => { notify = resolve })
    received = notify
    const before = calls, beforeBudget = dayUsed()
    const pending = api(action)
    await arrived
    const duplicate = await api(action)
    assert.equal(duplicate.body.status, 'pending')
    assert.equal(duplicate.body.snapshot.revision, 1)
    assert.equal((await api({ ...action, requestId: randomUUID() })).status, 409)
    assert.equal((await api({ ...action, text: 'Different text' })).status, 409)
    assert.equal(calls, before + 1); assert.equal(dayUsed(), beforeBudget + 1)
    release(); hold = null
    concurrency = (await pending).body
    assert.equal((await api(action)).body.status, 'done')
    assert.equal((await api({ ...action, requestId: randomUUID() })).status, 409)
    assert.equal(calls, before + 1)
  })
  await check('network, provider auth and invalid output failures consume attempts with no private error leak/retry/refund', async () => {
    for (const failure of ['network', 'status', 'invalid']) {
      const before = calls, beforeBudget = dayUsed()
      const action = responseBody(concurrency)
      providerMode = failure
      const failed = await api(action)
      providerMode = 'ok'
      assert.ok(failed.status >= 400)
      assert.equal(failed.body.snapshot.revision, concurrency.snapshot.revision + 1)
      assert.equal(failed.body.snapshot.pending, false)
      assert.equal(failed.body.story.scenes.length, concurrency.story.scenes.length)
      assert.ok(!JSON.stringify(failed.body).includes('private-provider') && !JSON.stringify(failed.body).includes('private-api-key'))
      assert.equal(dayUsed(), beforeBudget + 1)
      const repeat = await api(action)
      assert.equal(repeat.body.status, 'failed')
      assert.equal(calls, before + 1)
      concurrency = failed.body
    }
  })
  await check('abandoned reservation survives restart, expires as consumed, and late completion cannot overwrite', async () => {
    const op = { operation: 'reserve', id: concurrency.story.id, accountId: 'local-development', capabilityHash: journey.journeyHash(concurrency.story.journey.capability), cap: 1000, ...journey.parseJourneyAction(responseBody(concurrency)) }
    const reserved = await storyRepository().personalJourney(op)
    const before = calls
    assert.equal(reserved.status, 'reserved')
    now += 90001
    const resumed = await api({ mode: 'journey', action: 'resume', id: op.id, capability: concurrency.story.journey.capability })
    assert.equal(resumed.body.snapshot.pending, false)
    assert.equal(resumed.body.snapshot.revision, 5)
    assert.equal((await api({ ...responseBody(concurrency), requestId: op.requestId, text: op.text })).body.status, 'failed')
    await assert.rejects(storyRepository().personalJourney({ ...op, operation: 'finish', turn: opening.turn }), /expired/)
    assert.equal(calls, before)
    concurrency = resumed.body
  })
  await check('failed final response exhausts cap permanently, preserving last narration without fake conclusion', async () => {
    const action = responseBody(concurrency)
    providerMode = 'network'
    const before = calls
    const failed = await api(action)
    providerMode = 'ok'
    assert.equal(failed.body.snapshot.status, 'exhausted')
    assert.equal(failed.body.snapshot.revision, 6)
    assert.notEqual(failed.body.story.scenes.at(-1).body, conclusion)
    assert.equal((await api(responseBody(failed.body))).status, 409)
    assert.equal((await api(action)).body.status, 'failed')
    assert.equal(calls, before + 1)
  })
  await check('failed opening creation is durable, consumes generation allowance and never automatically regenerates', async () => {
    const creation = newCreation()
    const client = 'creation-failure-client', before = calls
    providerMode = 'network'
    const result = await api(creation, { address: client })
    providerMode = 'ok'
    assert.equal(result.body.snapshot.status, 'failed'); assert.equal(result.body.story, null)
    assert.equal((await api(creation, { address: client })).body.status, 'failed')
    const count = inspect(db => db.prepare("SELECT sum(count) total FROM shared_story_generation_limits WHERE bucket LIKE 'hour:%' AND bucket LIKE '%:generate:%'").get().total)
    assert.ok(count > 0)
    assert.equal(calls, before + 1)
  })
  await check('existing hourly generation limit applies to personal opening before provider call', async () => {
    const client = 'capped-creator'
    for (let i = 0; i < 5; i++) assert.equal((await api(newCreation(), { address: client })).status, 200)
    const before = calls
    const creation = newCreation()
    const blocked = await api(creation, { address: client })
    assert.equal(blocked.status, 429)
    assert.equal(blocked.body.snapshot.status, 'failed')
    assert.equal((await api(creation, { address: client })).body.status, 'failed')
    assert.equal(calls, before)
  })
  await check('input/output bounds enforce exact state, plans, metadata and final conclusion flag', () => {
    for (const invalid of [
      { ...opening.turn, extra: 'x' }, { ...opening.turn, state: { ...state, extra: 'x' } },
      { ...opening.turn, state: { ...state, inventory: Array(9).fill('x') } },
      { ...opening.turn, state: { ...state, progress: 'x'.repeat(301) } },
      { ...opening.turn, state: { ...state, discoveries: ['X', 'x'] } },
      { ...opening.turn, narration: Array(181).fill('word').join(' ') },
      { ...opening.turn, narration: 'short' }, { ...opening.turn, narration: `\u0000${narration}` },
      { ...opening.turn, concluded: true }
    ]) assert.throws(() => journey.parseJourneyTurn(invalid, false))
    assert.throws(() => journey.parseJourneyTurn(opening.turn, true))
    for (const invalid of [
      { ...opening, plan: Array(6).fill('point') }, { ...opening, plan: ['one', 'two'] },
      { ...opening, narrationLanguage: 'invalid-lang-tag' }, { ...opening, narrationStyle: 'evil' },
      { ...opening, title: 'x'.repeat(161) }, { ...opening, secret: 'hidden answer' }
    ]) assert.throws(() => journey.parseJourneyOpening(invalid))
    for (const patch of [{ text: '' }, { text: 'x'.repeat(801) }, { text: '\u0000x' }, { revision: 13 }, { requestId: 'x' }]) assert.throws(() => journey.parseJourneyAction({ ...responseBody(concurrency), ...patch }))
  })
  await check('Shared Adventure and personal journeys share the identical atomic UTC daily attempt bucket', async () => {
    const creation = newCreation()
    const personal = (await api(creation)).body
    const repo = storyRepository(), id = randomUUID()
    await repo.insert({
      id, owner_hash: 'owner', play_hash: 'play', answer_normalized: 'secret',
      expires_at: new Date(now + 3 * 86400000).toISOString(),
      brief: { creatorName: 'A', recipientName: 'B', narration: 'warm', setting: 'Garden', recipientHints: '', goal: 'Explore', solution: 'secret', message: 'PRIVATE_SHARED_MESSAGE', durationMinutes: 5, adventure: { actionBudget: 3 } },
      content: { title: 'Shared', description: 'A public garden.', scenes: [{ title: 'Gate', body: narration, clue: 'Notice the leaves.' }] }
    })
    await repo.advance(id, 'player', 'open', '')
    const before = dayUsed()
    process.env.MUSE_ADVENTURE_DAILY_ACTION_CAP = String(before + 1)
    const sharedOp = { operation: 'reserve', storyId: id, sessionHash: 'player', playHash: 'play', requestId: randomUUID(), fingerprint: 'a'.repeat(64), revision: 0, cap: before + 1 }
    assert.equal((await repo.adventure(sharedOp)).status, 'reserved')
    assert.equal(dayUsed(), before + 1)
    const callsBefore = calls
    assert.equal((await api({ ...responseBody(personal), cap: 99999, maxTurns: 99999 })).status, 429)
    assert.equal(calls, callsBefore)
    assert.equal((await api({ mode: 'journey', action: 'resume', id: creation.id, capability: creation.capability })).body.snapshot.revision, 0)
    now += 86400000
    process.env.MUSE_ADVENTURE_DAILY_ACTION_CAP = '1'
    assert.equal((await api(responseBody(personal))).status, 200)
    assert.equal(dayUsed(), 1)
    assert.equal((await repo.adventure({ ...sharedOp, operation: 'view' })).view.pending, false)
    await assert.rejects(repo.adventure({ ...sharedOp, requestId: randomUUID(), revision: 1, cap: 1 }), /AI budget reached/)
    process.env.MUSE_ADVENTURE_DAILY_ACTION_CAP = '1000'
  })
  await check('browser library retains journey capability/state and old saves without erasure; local copies cannot reset server', async () => {
    const storeMap = new Map()
    const storage = { getItem: key => storeMap.get(key) ?? null, setItem: (key, value) => storeMap.set(key, value), removeItem: key => storeMap.delete(key) }
    const personal = (await api({ mode: 'journey', action: 'resume', id: savedCreations[0].creation.id, capability: savedCreations[0].creation.capability })).body.story
    library.saveLibraryPersonalStory(personal, storage)
    assert.deepEqual(library.loadStoryLibrary(storage).library.entries[0].story, personal)
    const originalValue = storage.getItem(library.STORY_LIBRARY_KEY)
    assert.throws(() => library.saveLibraryPersonalStory({ ...personal, journey: { ...personal.journey, maxTurns: 999 } }, storage))
    assert.equal(storage.getItem(library.STORY_LIBRARY_KEY), originalValue)
    const altered = { ...personal, journey: { ...personal.journey, revision: 0 } }
    library.saveLibraryPersonalStory(altered, storage)
    assert.equal((await api(responseBody({ story: altered, snapshot: altered.journey }))).status, 409)
    const legacy = { id: 'old-local', title: 'Old story', description: 'Preserved', mood: 'hopeful', currentStep: 0, responses: [], createdAt: new Date(now).toISOString(), scenes: [{ title: 'Old', body: 'Unchanged legacy narration.', question: 'Choose?', choices: ['A', 'B', 'C'] }] }
    library.saveLibraryPersonalStory(legacy, storage)
    assert.equal(library.loadStoryLibrary(storage).library.entries.length, 2)
    assert.equal(library.loadStoryLibrary(storage).error, null)
  })
  await check('distinct personal sessions atomically compete for the last shared daily allowance', async () => {
    const first = (await api(newCreation())).body
    const second = (await api(newCreation())).body
    const before = dayUsed(), callsBefore = calls
    process.env.MUSE_ADVENTURE_DAILY_ACTION_CAP = String(before + 1)
    const results = await Promise.all([api(responseBody(first)), api(responseBody(second))])
    assert.deepEqual(results.map(result => result.status).sort(), [200, 429])
    assert.equal(dayUsed(), before + 1)
    assert.equal(calls, callsBefore + 1)
    const restored = await Promise.all([first, second].map(value => api({ mode: 'journey', action: 'resume', id: value.story.id, capability: value.story.journey.capability })))
    assert.deepEqual(restored.map(result => result.body.snapshot.revision).sort(), [0, 1])
    process.env.MUSE_ADVENTURE_DAILY_ACTION_CAP = '1000'
  })
  await check('legacy personal create/continue response shape and choices remain compatible', async () => {
    providerMode = 'legacy'
    const created = await api({ action: 'create', mood: 'hopeful', need: '', profileKeypoints: [] })
    assert.equal(created.status, 200)
    assert.equal(created.body.generation, 'ai')
    assert.equal(created.body.scenes.length, 3)
    assert.equal(created.body.journey, undefined)
    providerMode = 'legacy-continue'
    const continued = await api({ action: 'continue', story: created.body, answer: 'I follow the path.' })
    providerMode = 'ok'
    assert.equal(continued.status, 200)
    assert.equal(continued.body.currentStep, 1)
    assert.equal(continued.body.scenes[1].choices.length, 3)
    assert.equal((await api({ action: 'continue', story: savedCreations[0].initial.story, answer: 'Bypass' })).status, 400)
  })
  await check('two independent server processes serialize stale actions with one paid call', async () => {
    const created = (await api(newCreation())).body
    const script = `
      const handler = require(${JSON.stringify(handlerPath)}).default;
      let calls=0;
      global.fetch=async()=>{calls++;await new Promise(r=>setTimeout(r,180));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:${JSON.stringify(JSON.stringify(opening.turn))}}}]}))};
      const body=JSON.parse(process.argv[1]);
      const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(v){console.log(JSON.stringify({status:this.statusCode,calls,body:v}))}};
      handler({method:'POST',headers:{host:'localhost'},socket:{remoteAddress:'process'},body},res).catch(e=>{console.error(e);process.exitCode=1});
    `
    function child(body) {
      return new Promise((resolve, reject) => {
        const processChild = spawn(process.execPath, ['-e', script, JSON.stringify({ consentVersion, ...body })], { cwd: root, env: process.env })
        let text = '', errors = ''
        processChild.stdout.on('data', value => { text += value })
        processChild.stderr.on('data', value => { errors += value })
        processChild.on('error', reject)
        processChild.on('exit', code => code === 0 ? resolve(JSON.parse(text.trim())) : reject(new Error(errors)))
      })
    }
    const results = await Promise.all([child(responseBody(created)), child(responseBody(created))])
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
    childCalls = results.reduce((total, result) => total + result.calls, 0)
    assert.equal(childCalls, 1)
    assert.equal((await api({ mode: 'journey', action: 'resume', id: created.story.id, capability: created.story.journey.capability })).body.snapshot.revision, 1)
  })
  await check('Supabase journey operations verify account ownership before invoking the private RPC', async () => {
    const vm = require('node:vm')
    const compiled = fs.readFileSync(path.join(output, 'lib', 'storyRepository.js'), 'utf8')
    let call, error, rpcData = { record: {}, snapshot: { revision: 0 } }
    const exports = {}
    vm.runInNewContext(compiled, { exports, process: { env: { STORY_STORAGE: 'supabase', NEXT_PUBLIC_SUPABASE_URL: 'https://mock.invalid', SUPABASE_SERVICE_ROLE_KEY: 'mock-service-key' } }, console,
      require(name) {
        if (name === '@supabase/supabase-js') return { createClient() { return {
          from() { return { select() { return { eq() { return this }, async maybeSingle() { return { data: { capability_hash: request.capabilityHash }, error: null } } } } } },
          async rpc(name, params) { call = { name, params }; return { data: rpcData, error } }
        } } }
        return require(path.resolve(path.dirname(path.join(output, 'lib', 'storyRepository.js')), name))
      }
    })
    const request = { operation: 'view', id: randomUUID(), accountId: 'fixture-account', capabilityHash: 'a'.repeat(64), cap: 100 }
    await exports.storyRepository().personalJourney(request)
    assert.equal(call.name, 'muse_personal_journey'); assert.deepEqual(JSON.parse(JSON.stringify(call.params.input)), request)
    error = { message: 'private-database-error' }
    await assert.rejects(exports.storyRepository().personalJourney(request), /Apply supabase\/personal-journeys.sql/)
    error = { message: 'Journey: session unavailable' }
    await assert.rejects(exports.storyRepository().personalJourney(request), err => err.status === 404)
    error = null; rpcData = { unavailable: true }
    await assert.rejects(exports.storyRepository().personalJourney(request), err => err.status === 404)
    const sql = fs.readFileSync(path.join(root, 'supabase', 'personal-journeys.sql'), 'utf8')
    for (const clause of ['security definer set search_path = public, pg_temp', 'enable row level security', 'from public, anon, authenticated', 'to service_role', 'pg_advisory_xact_lock', 'for update', "at time zone 'UTC'", 'public.muse_adventure_budgets', "interval '90 seconds'", "when 5 then 3 when 10 then 6 when 15 then 9 when 20 then 12", "'expiresAt', null", "'infinity'::timestamptz"]) assert.ok(sql.includes(clause))
    assert.ok(fs.existsSync(path.join(root, 'supabase', 'personal-journey-retention.sql')))
    assert.ok(sql.includes('owner_id = account_id'))
  })
  await check('My Story UI uses authoritative mood, account sign-in, shared dictation and automatic resume checks', () => {
    const ui = fs.readFileSync(path.join(root, 'src', 'pages', 'story.tsx'), 'utf8')
    assert.ok(ui.includes('mood: selectedMood'))
    assert.ok(!ui.includes('inferPersonalStoryMood'))
    assert.ok(ui.includes('useStoryInteraction'))
    assert.ok(!ui.includes('Dictation language'))
    assert.ok(ui.includes('useStoryInteraction(stopSpeaking, story?.language || language)'))
    assert.ok(ui.includes('Editable response'))
    assert.ok(ui.includes('accountFetch'))
    assert.ok(ui.includes('Go to your Muse account'))
    assert.ok(!ui.includes('x-muse-creator-code'))
    assert.ok(!ui.includes('setInterval'))
    assert.ok(ui.includes('window.setTimeout') && ui.includes('window.clearTimeout'))
    assert.ok(!ui.includes('Sync saved progress (no AI call)'))
    assert.ok(ui.includes('!story.journey ? <>'))
  })
  await check('personal deletion requires account ownership, cascades requests without resetting budgets or calling AI', async () => {
    const created = await api(newCreation())
    assert.equal(created.status, 200)
    const body = { mode: 'journey', action: 'delete', id: created.body.story.id, capability: created.body.story.journey.capability }
    const before = calls, used = dayUsed()
    assert.equal((await api({ ...body, capability: 'a'.repeat(64) })).status, 200, 'The authenticated account, not a browser capability, authorizes deletion')
    assert.equal((await api({ ...body, action: 'resume' })).status, 404)
    assert.equal((await api(body)).status, 404)
    assert.equal(calls, before)
    assert.equal(dayUsed(), used)
    assert.equal(inspect(db => db.prepare('SELECT count(*) total FROM muse_personal_journey_requests WHERE journey_id = ?').get(body.id).total), 0)
  })
  await check('surviving legacy personal journeys become permanent and remain available until deletion', async () => {
    const { creation } = savedCreations[0], before = calls
    now += 31 * 86400000
    const resumed = await api({ mode: 'journey', action: 'resume', id: creation.id, capability: creation.capability })
    assert.equal(resumed.status, 200)
    assert.equal(resumed.body.story.id, creation.id)
    const row = inspect(db => db.prepare('SELECT record, expires_at FROM muse_personal_journeys WHERE id = ?').get(creation.id))
    assert.equal(row.expires_at, 'infinity')
    assert.equal(JSON.parse(row.record).expiresAt, null)
    assert.ok(inspect(db => db.prepare('SELECT count(*) total FROM muse_personal_journey_requests WHERE journey_id = ?').get(creation.id).total) > 0)
    assert.equal(calls, before)
  })
  console.log(`\n${passed} personal journey checks passed; ${calls + childCalls} mocked provider calls, zero real AI/hosted database requests.`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  process.env = original.env; global.fetch = original.fetch; Date.now = original.now; global.window = original.window
  fs.rmSync(output, { recursive: true, force: true })
})

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync, spawn } = require('node:child_process')
const { createHash, randomUUID } = require('node:crypto')
const { DatabaseSync } = require('node:sqlite')

const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.sqlite-story-tests-'))
const env = { ...process.env }
const fetch = global.fetch
const realNow = Date.now
let now = Math.floor(realNow() / 3600000) * 3600000 + 60000
let passed = 0
let consentVersion
const hash = value => createHash('sha256').update(value).digest('hex')
const filename = path.join(output, 'private', 'stories.sqlite')
let providerCalls = 0

async function check(name, run) {
  await run()
  passed++
  console.log(`PASS ${name}`)
}

async function main() {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/pages/api/shared-story.ts', 'src/pages/api/personal-story.ts',
    '--outDir', output, '--module', 'commonjs', '--target', 'es2020',
    '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })
  process.env.STORY_STORAGE = 'sqlite'
  process.env.MUSE_SQLITE_PATH = filename
  process.env.LLM_PROVIDER = 'GROQ'
  process.env.LLM_API_KEY = 'test-not-real'
  delete process.env.VERCEL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  Date.now = () => now
  const repositoryModule = path.join(output, 'lib', 'storyRepository.js')
  const { storyRepository } = require(repositoryModule)
  const handler = require(path.join(output, 'pages', 'api', 'shared-story.js')).default
  const personalHandler = require(path.join(output, 'pages', 'api', 'personal-story.js')).default
  consentVersion = require(path.join(output, 'lib', 'legalContact.js')).MUSE_AI_CONSENT_VERSION
  const { sceneCountForDuration } = require(path.join(output, 'lib', 'sharedStory.js'))
  const brief = {
    creatorName: 'Alex', recipientName: 'Sam', narration: 'Playful detective narration',
    setting: 'A room with a desk and stars painted on the ceiling.',
    recipientHints: 'Sam likes astronomy.', goal: 'Find the hidden letter.',
    solution: 'behind the blue notebook', message: 'Meet me tomorrow at our favourite cafe.', durationMinutes: 5
  }
  const content = {
    title: 'The Room of Stars', description: 'Follow the familiar clues.',
    narrationStyle: 'suspenseful', narrationLanguage: 'en-US',
    scenes: Array.from({ length: sceneCountForDuration(5) }, (_, i) => ({
      title: `Discovery ${i + 1}`, body: Array(Math.ceil(350 / sceneCountForDuration(5))).fill('wonder').join(' '),
      clue: 'Look where the constellations were drawn.'
    }))
  }
  global.fetch = async (url) => {
    assert.equal(String(url), 'https://api.groq.com/openai/v1/chat/completions', 'Only the mock AI endpoint is allowed')
    providerCalls++
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200 })
  }
  async function api(body, selected = handler, address = '127.0.0.1', extraHeaders = {}) {
    let status = 200
    let result
    const headers = {}
    const res = { setHeader: (key, value) => { headers[key] = value }, status: value => { status = value; return res }, json: value => { result = value; return res } }
    await selected({ method: 'POST', headers: { host: 'localhost:3000', ...extraHeaders }, socket: { remoteAddress: address }, body: { consentVersion, ...body } }, res)
    assert.equal(headers['Cache-Control'], 'no-store')
    return { status, body: result }
  }
  function inspect(run) {
    const db = new DatabaseSync(filename)
    try { return run(db) } finally { db.close() }
  }
  let created, session, id
  await check('legacy SQLite schema upgrades atomically without losing stories or player progress', async () => {
    fs.mkdirSync(path.dirname(filename), { recursive: true })
    const legacy = new DatabaseSync(filename)
    try {
      legacy.exec(`
        CREATE TABLE shared_stories (id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, play_hash TEXT NOT NULL, brief TEXT NOT NULL, content TEXT NOT NULL, answer_normalized TEXT NOT NULL, expires_at TEXT NOT NULL);
        CREATE TABLE shared_story_sessions (story_id TEXT NOT NULL REFERENCES shared_stories(id) ON DELETE CASCADE, player_hash TEXT NOT NULL, current_scene INTEGER NOT NULL DEFAULT 0, solved INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, last_attempt_at INTEGER, PRIMARY KEY(story_id, player_hash));
        CREATE TABLE muse_personal_journeys (id TEXT PRIMARY KEY, capability_hash TEXT NOT NULL, record TEXT NOT NULL, expires_at TEXT NOT NULL);
        CREATE TABLE muse_personal_journey_requests (
          journey_id TEXT NOT NULL REFERENCES muse_personal_journeys(id) ON DELETE CASCADE,
          request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, kind TEXT NOT NULL,
          status TEXT NOT NULL, reserved_at INTEGER NOT NULL, revision INTEGER NOT NULL,
          PRIMARY KEY(journey_id, request_id)
        );
      `)
      legacy.prepare('INSERT INTO shared_stories VALUES (?, ?, ?, ?, ?, ?, ?)').run('legacy', 'owner', 'play', JSON.stringify(brief), JSON.stringify(content), brief.solution, new Date(now + 86400000).toISOString())
      legacy.prepare('INSERT INTO shared_story_sessions VALUES (?, ?, ?, ?, ?, ?)').run('legacy', 'player', 1, 0, 2, null)
      const oldPersonalRecord = JSON.stringify({ id: 'legacy-personal', expiresAt: new Date(now - 86400000).toISOString() })
      legacy.prepare('INSERT INTO muse_personal_journeys VALUES (?, ?, ?, ?)').run('legacy-personal', 'hashed-capability', oldPersonalRecord, JSON.parse(oldPersonalRecord).expiresAt)
      legacy.prepare('INSERT INTO muse_personal_journey_requests VALUES (?, ?, ?, ?, ?, ?, ?)').run('legacy-personal', 'request', 'fingerprint', 'create', 'pending', now - 100000, 0)
    } finally { legacy.close() }
    const repo = storyRepository()
    assert.equal((await repo.findUnexpired('legacy')).brief.solution, brief.solution)
    assert.equal(inspect(db => db.prepare('SELECT expires_at FROM shared_stories WHERE id = ?').get('legacy')).expires_at, 'infinity')
    assert.deepEqual(await repo.advance('legacy', 'player', 'hint', ''), { current_scene: 1, solved: false, skipped: false, revealed_hints: 0 })
    assert.deepEqual(await storyRepository().advance('legacy', 'player', 'open', ''), { current_scene: 1, solved: false, skipped: false, revealed_hints: 0 })
    assert.equal(inspect(db => db.prepare('SELECT attempts FROM shared_story_sessions WHERE story_id = ?').get('legacy')).attempts, 2)
    assert.equal(inspect(db => db.prepare('SELECT alternative_answers_normalized FROM shared_stories WHERE id = ?').get('legacy')).alternative_answers_normalized, '[]')
    const personal = inspect(db => db.prepare('SELECT record, expires_at FROM muse_personal_journeys WHERE id = ?').get('legacy-personal'))
    assert.equal(personal.expires_at, 'infinity')
    assert.equal(JSON.parse(personal.record).expiresAt, null)
    assert.equal(inspect(db => db.prepare('SELECT status FROM muse_personal_journey_requests WHERE journey_id = ?').get('legacy-personal')).status, 'pending')
    assert.deepEqual(inspect(db => db.prepare('PRAGMA foreign_key_check').all()), [])
  })
  await check('explicit SQLite creates schema without Supabase credentials and keeps capabilities hashed', async () => {
    created = await api({ action: 'create', brief })
    assert.equal(created.status, 201)
    id = created.body.ownerToken.split('.')[0]
    assert.notEqual(created.body.ownerToken, created.body.playToken)
    const row = inspect(db => db.prepare('SELECT * FROM shared_stories WHERE id = ?').get(id))
    assert.equal(row.expires_at, 'infinity', 'New shared gifts are kept until deletion')
    assert.equal((await storyRepository().findUnexpired(id)).expires_at, 'infinity', 'Repository keeps the storage sentinel for expiry comparisons')
    assert.equal(row.owner_hash, hash(created.body.ownerToken.split('.')[1]))
    assert.equal(row.play_hash, hash(created.body.playToken.split('.')[1]))
    assert.equal(row.answer_normalized, brief.solution)
    assert.ok(!JSON.stringify(row).includes(created.body.playToken.split('.')[1]))
    const managed = await api({ action: 'manage', token: created.body.ownerToken })
    assert.equal(managed.body.brief.solution, brief.solution)
    assert.equal(managed.body.expiresAt, null, 'API exposes permanent retention without leaking its storage sentinel')
  })
  await check('owner/play separation, wrong/correct answers, cooldown and persisted progress use actual API', async () => {
    for (const action of ['manage', 'progress', 'delete', 'share']) assert.equal((await api({ action, token: created.body.playToken })).status, 404)
    assert.equal((await api({ action: 'open', token: created.body.ownerToken })).status, 404)
    const opened = await api({ action: 'open', token: created.body.playToken })
    session = opened.body.sessionToken
    const next = await api({ action: 'next', token: created.body.playToken, sessionToken: session })
    assert.equal(next.body.player.sceneIndex, 1)
    const wrong = await api({ action: 'guess', token: created.body.playToken, sessionToken: session, guess: 'wrong answer' })
    assert.equal(wrong.status, 200)
    for (const response of [opened, next, wrong]) {
      assert.ok(!JSON.stringify(response.body).includes(brief.message))
      assert.ok(!JSON.stringify(response.body).includes(brief.solution))
    }
    assert.equal((await api({ action: 'guess', token: created.body.playToken, sessionToken: session, guess: brief.solution })).status, 429)
    now += 2000
    const solved = await api({ action: 'guess', token: created.body.playToken, sessionToken: session, guess: 'BEHIND THE BLUE NOTEBOOK!' })
    assert.equal(solved.status, 200)
    assert.equal(solved.body.player.solved, true)
    assert.equal(solved.body.player.message, brief.message)
    assert.ok(!JSON.stringify(solved.body).includes(brief.solution))
    const state = await storyRepository().advance(id, hash(session), 'next', '')
    assert.deepEqual(state, { current_scene: 1, solved: true, skipped: false, revealed_hints: 0 })
    const reopened = JSON.parse(execFileSync(process.execPath, ['-e',
      `require(${JSON.stringify(repositoryModule)}).storyRepository().advance(${JSON.stringify(id)}, ${JSON.stringify(hash(session))}, 'open', '').then(s => console.log(JSON.stringify(s)))`
    ], { cwd: root, env: process.env, encoding: 'utf8' }))
    assert.deepEqual(reopened, state)
  })
  await check('private progress counts actual playthroughs, separates solved/skip, persists and never calls AI', async () => {
    const repo = storyRepository()
    const fixture = { ...await repo.findUnexpired(id), id: randomUUID(), brief: { ...brief, unlockPolicy: 'allow-skip' } }
    await repo.insert(fixture)
    const ownerToken = `${fixture.id}.${created.body.ownerToken.split('.')[1]}`
    const token = `${fixture.id}.${created.body.playToken.split('.')[1]}`
    const summary = async () => api({ action: 'progress', token: ownerToken })
    const empty = { opened: 0, inProgress: 0, solved: 0, skipped: 0, furthestScene: null }
    const callsBefore = providerCalls
    assert.deepEqual((await summary()).body, { progress: { ...empty, sceneCount: content.scenes.length } })
    assert.equal((await api({ action: 'progress', token })).status, 404)
    const opened = await Promise.all(Array.from({ length: 3 }, () => api({ action: 'open', token })))
    const sessions = opened.map(result => result.body.sessionToken)
    for (let i = 1; i < content.scenes.length; i++) {
      await api({ action: 'next', token, sessionToken: sessions[0] })
    }
    assert.equal((await summary()).body.progress.solved, 0, 'Last scene reached is not a completion')
    assert.equal((await api({ action: 'guess', token, sessionToken: sessions[1], guess: brief.solution })).status, 200)
    assert.equal((await api({ action: 'skip', token, sessionToken: sessions[2], confirmSkip: true })).status, 200)
    await api({ action: 'open', token, sessionToken: sessions[0] })
    const expected = { opened: 3, inProgress: 1, solved: 1, skipped: 1, furthestScene: content.scenes.length - 1 }
    assert.deepEqual((await summary()).body, { progress: { ...expected, sceneCount: content.scenes.length } })
    assert.deepEqual(await storyRepository().progress(fixture.id), expected, 'A fresh repository sees durable progress')
    const serialized = JSON.stringify((await summary()).body)
    for (const secret of [...sessions, brief.solution, brief.message, fixture.owner_hash, fixture.play_hash]) assert.ok(!serialized.includes(secret))
    process.env.MUSE_CREATOR_ACCESS_CODE = 'progress-test-private-code'
    assert.equal((await summary()).status, 401)
    assert.equal((await api({ action: 'progress', token: ownerToken }, handler, '127.0.0.1', { 'x-muse-creator-code': process.env.MUSE_CREATOR_ACCESS_CODE })).status, 200)
    delete process.env.MUSE_CREATOR_ACCESS_CODE
    const rotated = await api({ action: 'share', token: ownerToken })
    assert.equal(rotated.status, 200)
    assert.deepEqual((await summary()).body.progress, { ...expected, sceneCount: content.scenes.length }, 'Rotation preserves historical counts')
    assert.equal(providerCalls, callsBefore)
    inspect(db => db.prepare('UPDATE shared_stories SET expires_at = ? WHERE id = ?').run(new Date(now - 1000).toISOString(), fixture.id))
    assert.equal((await summary()).status, 404)
    await repo.delete(fixture.id)
    assert.equal((await summary()).status, 404)
  })
  await check('live progress counts generated scenes per recipient, excludes failed/pending actions and stays read-only', async () => {
    const repo = storyRepository()
    const fixture = { ...await repo.findUnexpired(id), id: randomUUID(), brief: { ...brief, adventure: { actionBudget: 12 } } }
    await repo.insert(fixture)
    const ownerToken = `${fixture.id}.${created.body.ownerToken.split('.')[1]}`
    const token = `${fixture.id}.${created.body.playToken.split('.')[1]}`
    const summary = () => api({ action: 'progress', token: ownerToken })
    const calls = providerCalls
    assert.equal((await summary()).body.progress.furthestScene, null)
    const first = await api({ action: 'open', token })
    const second = await api({ action: 'open', token })
    assert.equal((await summary()).body.progress.furthestScene, 0, 'Opening is scene one before any action')
    inspect(db => {
      const insertSession = db.prepare('INSERT OR IGNORE INTO muse_adventure_sessions(story_id, player_hash) VALUES (?, ?)')
      const insert = db.prepare('INSERT INTO muse_adventure_requests(story_id, player_hash, request_id, fingerprint, status, reserved_at, revision) VALUES (?, ?, ?, ?, ?, ?, ?)')
      for (const [session, statuses] of [[first.body.sessionToken, ['done', 'failed', 'done', 'pending']], [second.body.sessionToken, ['done']]]) {
        insertSession.run(fixture.id, hash(session))
        statuses.forEach((status, index) => insert.run(fixture.id, hash(session), randomUUID(), 'synthetic', status, now, index + 1))
      }
    })
    const result = (await summary()).body.progress
    assert.equal(result.sceneCount, null)
    assert.equal(result.furthestScene, 2, 'Two successful generated scenes plus opening; do not sum recipients or count failures')
    assert.equal(result.inProgress, 2)
    assert.equal(result.solved, 0)
    const originalCode = process.env.MUSE_CREATOR_ACCESS_CODE
    process.env.MUSE_CREATOR_ACCESS_CODE = 'synthetic-auto-progress-code'
    try {
      const combined = await api({ action: 'library', includeProgress: true }, handler, '127.0.0.1', { 'x-muse-creator-code': process.env.MUSE_CREATOR_ACCESS_CODE })
      assert.equal(combined.status, 200)
      assert.deepEqual(combined.body.stories.find(story => story.ownerToken.startsWith(fixture.id)).progress, result)
      const { sceneCount, ...expected } = result
      assert.deepEqual(await repo.progress(fixture.id, true), expected, 'Loading the collection does not mutate recipient progress')
    } finally {
      if (originalCode === undefined) delete process.env.MUSE_CREATOR_ACCESS_CODE
      else process.env.MUSE_CREATOR_ACCESS_CODE = originalCode
    }
    assert.equal(providerCalls, calls)
    await repo.delete(fixture.id)
  })
  await check('30 guesses per session are durable and solved sessions do not consume more attempts', async () => {
    const opened = await api({ action: 'open', token: created.body.playToken })
    const token = opened.body.sessionToken
    for (let i = 0; i < 30; i++) {
      now += 2000
      assert.equal((await api({ action: 'guess', token: created.body.playToken, sessionToken: token, guess: 'wrong' })).status, 200)
    }
    now += 2000
    assert.equal((await api({ action: 'guess', token: created.body.playToken, sessionToken: token, guess: brief.solution })).status, 429)
    assert.equal(inspect(db => db.prepare('SELECT attempts FROM shared_story_sessions WHERE story_id = ? AND player_hash = ?').get(id, hash(token))).attempts, 30)
    await storyRepository().advance(id, hash(session), 'guess', 'wrong')
    assert.equal(inspect(db => db.prepare('SELECT attempts FROM shared_story_sessions WHERE story_id = ? AND player_hash = ?').get(id, hash(session))).attempts, 2)
  })
  await check('generation cap is shared by personal API and denies calls before AI execution', async () => {
    for (let i = 0; i < 4; i++) assert.equal((await api({ action: 'create', brief })).status, 201)
    const before = providerCalls
    assert.equal((await api({ action: 'create', brief })).status, 429)
    assert.equal((await api({ action: 'create', mood: 'curious', need: '', profileKeypoints: [] }, personalHandler)).status, 429)
    assert.equal(providerCalls, before)
  })
  await check('client guess cap and daily budgets match hosted SQL; denied reservations do not increment', async () => {
    const repo = storyRepository()
    for (let i = 0; i < 60; i++) assert.equal(await repo.reserve('guess-budget', 'guess'), true)
    assert.equal(await repo.reserve('guess-budget', 'guess'), false)
    const day = `day:${new Date(now).toISOString().slice(0, 10)}:generate`
    inspect(db => db.prepare('UPDATE shared_story_generation_limits SET count = 100 WHERE bucket = ?').run(day))
    assert.equal(await repo.reserve('another-client', 'generate'), false)
    const guessDay = day.replace('generate', 'guess')
    inspect(db => db.prepare('UPDATE shared_story_generation_limits SET count = 5000 WHERE bucket = ?').run(guessDay))
    assert.equal(await repo.reserve('another-client', 'guess'), false)
    inspect(db => db.prepare('DELETE FROM shared_story_generation_limits').run())
  })
  await check('parallel independent SQLite connections atomically enforce a five-generation budget', async () => {
    const code = `require(${JSON.stringify(repositoryModule)}).storyRepository().reserve('concurrent', 'generate').then(s => console.log(JSON.stringify(s)))`
    const results = await Promise.all(Array.from({ length: 12 }, () => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['-e', code], { cwd: root, env: process.env })
      let out = '', err = ''
      child.stdout.on('data', text => { out += text })
      child.stderr.on('data', text => { err += text })
      child.on('error', reject)
      child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(err)))
    })))
    assert.equal(results.filter(Boolean).length, 5)
  })
  await check('creator-approved alternatives and progressive hints remain private and persist per player', async () => {
    const assistedBrief = { ...brief,
      assistanceHints: ['Think about the paper cover.', 'Remember the colour of the sea.', 'Look under the journal.'],
      alternativeAnswers: ['under the azure journal', 'Café — étoile']
    }
    const made = await api({ action: 'create', brief: assistedBrief }, handler, 'assistance-client')
    assert.equal(made.status, 201)
    const token = made.body.playToken
    const storyId = token.split('.')[0]
    assert.deepEqual((await api({ action: 'manage', token: made.body.ownerToken })).body.brief, assistedBrief)
    assert.equal((await api({ action: 'hint', token, sessionToken: 'd'.repeat(64) })).status, 400)
    assert.equal((await api({ action: 'hint', token })).status, 400)
    assert.equal((await api({ action: 'hint', token: made.body.ownerToken, sessionToken: 'd'.repeat(64) })).status, 404)
    const opened = await api({ action: 'open', token })
    const playerToken = opened.body.sessionToken
    assert.deepEqual(opened.body.player.revealedHints, [])
    assert.equal(opened.body.player.hintsRemaining, 3)
    const beforeCalls = providerCalls
    const first = await api({ action: 'hint', token, sessionToken: playerToken })
    assert.deepEqual(first.body.player.revealedHints, assistedBrief.assistanceHints.slice(0, 1))
    assert.equal(first.body.player.hintsRemaining, 2)
    assert.equal(first.body.player.sceneIndex, 0)
    const serialized = JSON.stringify(first.body)
    for (const secret of [brief.solution, brief.message, ...assistedBrief.alternativeAnswers, ...assistedBrief.assistanceHints.slice(1)]) assert.ok(!serialized.includes(secret))
    const reopened = JSON.parse(execFileSync(process.execPath, ['-e',
      `require(${JSON.stringify(repositoryModule)}).storyRepository().advance(${JSON.stringify(storyId)}, ${JSON.stringify(hash(playerToken))}, 'open', '').then(s => console.log(JSON.stringify(s)))`
    ], { cwd: root, env: process.env, encoding: 'utf8' }))
    assert.equal(reopened.revealed_hints, 1)
    assert.equal((await api({ action: 'open', token })).body.player.revealedHints.length, 0)
    const code = `require(${JSON.stringify(repositoryModule)}).storyRepository().advance(${JSON.stringify(storyId)}, ${JSON.stringify(hash(playerToken))}, 'hint', '').then(s => console.log(JSON.stringify(s)))`
    const results = await Promise.all(Array.from({ length: 8 }, () => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['-e', code], { cwd: root, env: process.env })
      let out = '', err = ''
      child.stdout.on('data', text => { out += text })
      child.stderr.on('data', text => { err += text })
      child.on('error', reject)
      child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(err)))
    })))
    assert.ok(results.every(result => result.revealed_hints <= 3 && result.current_scene === 0))
    const exhausted = await api({ action: 'hint', token, sessionToken: playerToken })
    assert.deepEqual(exhausted.body.player.revealedHints, assistedBrief.assistanceHints)
    assert.equal(exhausted.body.player.hintsRemaining, 0)
    assert.equal(providerCalls, beforeCalls)
    assert.equal(inspect(db => db.prepare('SELECT attempts FROM shared_story_sessions WHERE story_id = ? AND player_hash = ?').get(storyId, hash(playerToken))).attempts, 0)
    for (const guess of ['  UNDER the azure JOURNAL!!! ', 'CAFÉ étoile']) {
      const fresh = await api({ action: 'open', token })
      const solved = await api({ action: 'guess', token, sessionToken: fresh.body.sessionToken, guess })
      assert.equal(solved.body.player.solved, true)
      assert.equal(solved.body.player.message, brief.message)
      assert.deepEqual((await api({ action: 'hint', token, sessionToken: fresh.body.sessionToken })).body.player.revealedHints, [])
    }
    const fresh = await api({ action: 'open', token })
    assert.equal((await api({ action: 'guess', token, sessionToken: fresh.body.sessionToken, guess: 'azure journal' })).body.player.solved, false)
    const expectedHash = hash(token.split('.')[1])
    await storyRepository().rotate(storyId, hash('e'.repeat(64)))
    await assert.rejects(() => storyRepository().advance(storyId, hash(playerToken), 'hint', '', expectedHash), error => error.status === 404)
    assert.equal((await api({ action: 'hint', token, sessionToken: playerToken })).status, 404)
    await storyRepository().delete(storyId)
    await assert.rejects(() => storyRepository().advance(storyId, hash(playerToken), 'hint', ''), error => error.status === 404)
  })
  await check('skipping is opt-in, confirmed, session-bound, durable and never counts as solving or AI use', async () => {
    const legacyOpen = await api({ action: 'open', token: created.body.playToken })
    assert.equal(legacyOpen.body.player.canSkip, false)
    assert.equal((await api({ action: 'skip', token: created.body.playToken, sessionToken: legacyOpen.body.sessionToken, confirmSkip: true })).status, 403)
    const made = await api({ action: 'create', brief: { ...brief, unlockPolicy: 'allow-skip', adventure: { actionBudget: 3 } } }, handler, 'skip-client')
    assert.equal(made.status, 201)
    const token = made.body.playToken
    const storyId = token.split('.')[0]
    const opened = await api({ action: 'open', token })
    const sessionToken = opened.body.sessionToken
    assert.equal(opened.body.player.canSkip, true)
    const before = providerCalls
    const args = { action: 'skip', token, sessionToken }
    assert.equal((await api(args)).status, 400)
    assert.equal((await api({ ...args, confirmSkip: 'true' })).status, 400)
    assert.equal((await api({ ...args, sessionToken: 'e'.repeat(64), confirmSkip: true })).status, 400)
    const repo = storyRepository()
    const reservation = { storyId, sessionHash: hash(sessionToken), playHash: hash(token.split('.')[1]), cap: 100,
      requestId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', fingerprint: 'fixture', revision: 0 }
    assert.equal((await repo.adventure({ ...reservation, operation: 'reserve' })).status, 'reserved')
    const skipped = await api({ ...args, confirmSkip: true })
    assert.equal(skipped.status, 200, JSON.stringify(skipped.body))
    assert.equal(skipped.body.player.solved, false)
    assert.equal(skipped.body.player.skipped, true)
    assert.equal(skipped.body.player.canSkip, false)
    assert.equal(skipped.body.player.message, brief.message)
    assert.equal(skipped.body.player.adventure.pending, false)
    assert.ok(!JSON.stringify(skipped.body).includes(brief.solution))
    assert.equal((await api({ ...args, confirmSkip: true })).body.player.skipped, true)
    assert.equal((await api({ action: 'guess', token, sessionToken, guess: brief.solution })).body.player.solved, false)
    assert.equal((await api({ action: 'adventure', token, sessionToken })).status, 409)
    await assert.rejects(() => repo.adventure({ ...reservation, operation: 'finish', failed: true }), e => e.status === 409)
    await assert.rejects(() => repo.adventure({ ...reservation, requestId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', revision: 1, operation: 'reserve' }), e => e.status === 409)
    assert.equal(providerCalls, before)
    const persisted = JSON.parse(execFileSync(process.execPath, ['-e',
      `require(${JSON.stringify(repositoryModule)}).storyRepository().advance(${JSON.stringify(storyId)},${JSON.stringify(hash(sessionToken))},'open','').then(s=>console.log(JSON.stringify(s)))`
    ], { cwd: root, env: process.env, encoding: 'utf8' }))
    assert.equal(persisted.skipped, true)
    assert.equal(persisted.solved, false)
    const fresh = await api({ action: 'open', token })
    assert.equal(fresh.body.player.skipped, false)
    assert.equal(fresh.body.player.message, undefined)
    assert.equal(inspect(db => db.prepare('SELECT attempts FROM shared_story_sessions WHERE story_id=? AND player_hash=?').get(storyId, hash(sessionToken))).attempts, 0)
    await repo.rotate(storyId, hash('replacement'))
    assert.equal((await api({ ...args, confirmSkip: true })).status, 404)
    await repo.delete(storyId)
  })
  await check('administrator recovery restores retained gifts without changing original capabilities or progress', async () => {
    const callsBefore = providerCalls
    assert.equal((await api({ action: 'library' })).status, 503, 'Local development must not expose an ungated collection')
    const code = 'synthetic-recovery-admin-code'
    process.env.MUSE_CREATOR_ACCESS_CODE = code
    const auth = { 'x-muse-creator-code': code }
    try {
      assert.equal((await api({ action: 'library' })).status, 401)
      assert.equal((await api({ action: 'library' }, handler, '127.0.0.1', { 'x-muse-creator-code': 'incorrect' })).status, 401)
      assert.equal((await api({ action: 'library', after: 'not-a-uuid' }, handler, '127.0.0.1', auth)).status, 400)
      const before = await storyRepository().findUnexpired(id)
      const progressBefore = await storyRepository().progress(id)
      const result = await api({ action: 'library' }, handler, '127.0.0.1', auth)
      assert.equal(result.status, 200)
      assert.deepEqual(await storyRepository().progress(id), progressBefore, 'Listing never creates a recipient session')
      const restored = result.body.stories.find(story => story.ownerToken.startsWith(id + '.'))
      assert.ok(restored)
      assert.ok(!JSON.stringify(restored).includes(before.owner_hash))
      assert.notEqual(restored.ownerToken, created.body.ownerToken)
      assert.equal((await api({ action: 'manage', token: restored.ownerToken }, handler, '127.0.0.1', auth)).status, 200)
      assert.equal((await api({ action: 'manage', token: restored.playToken }, handler, '127.0.0.1', auth)).status, 404)
      assert.equal((await api({ action: 'open', token: restored.ownerToken })).status, 404)
      assert.equal((await api({ action: 'open', token: restored.playToken })).status, 200)
      assert.equal((await api({ action: 'open', token: created.body.playToken })).status, 200)
      const after = await storyRepository().findUnexpired(id)
      assert.equal(after.owner_hash, before.owner_hash)
      assert.equal(after.play_hash, before.play_hash)
      // Opening a recipient link is a real playthrough, but listing/recovery
      // itself must not create one.
      assert.deepEqual((await api({ action: 'progress', token: restored.ownerToken }, handler, '127.0.0.1', auth)).body.progress,
        { ...await storyRepository().progress(id), sceneCount: before.content.scenes.length })
      const { recoveryKey, matchesRecoveryKey } = require(path.join(output, 'lib', 'creatorRecovery.js'))
      assert.equal(matchesRecoveryKey(restored.playToken.split('.')[1], { ...before, play_hash: hash('rotated') }, 'play'), false)
      assert.notEqual(recoveryKey({ ...before, id: randomUUID() }, 'play'), restored.playToken.split('.')[1])
      process.env.MUSE_CREATOR_ACCESS_CODE = code + '-changed'
      assert.equal((await api({ action: 'open', token: restored.playToken })).status, 404)
      assert.equal((await api({ action: 'open', token: created.body.playToken })).status, 200)
      assert.equal(providerCalls, callsBefore, 'Recovery never calls the AI provider')
      process.env.MUSE_CREATOR_ACCESS_CODE = code
      const extraIds = []
      for (let index = 0; index < 23; index++) {
        const extraId = randomUUID()
        extraIds.push(extraId)
        await storyRepository().insert({ ...before, id: extraId })
      }
      const seen = new Set()
      let cursor = null
      do {
        const page = await api({ action: 'library', after: cursor }, handler, '127.0.0.1', auth)
        assert.equal(page.status, 200)
        assert.ok(page.body.stories.length <= 20)
        for (const item of page.body.stories) {
          const key = item.ownerToken.split('.')[0]
          assert.ok(!seen.has(key), 'Pagination must not repeat stories')
          seen.add(key)
        }
        cursor = page.body.next
      } while (cursor)
      for (const extraId of extraIds) {
        assert.ok(seen.has(extraId))
        await storyRepository().delete(extraId)
      }
    } finally { delete process.env.MUSE_CREATOR_ACCESS_CODE }
  })
  await check('rotation invalidates old play capability and deletion cascades persisted sessions', async () => {
    const rotated = await api({ action: 'share', token: created.body.ownerToken })
    assert.equal(rotated.status, 200)
    assert.equal((await api({ action: 'open', token: created.body.playToken })).status, 404)
    assert.equal((await api({ action: 'open', token: rotated.body.playToken, sessionToken: session })).body.player.solved, true)
    assert.equal((await api({ action: 'delete', token: created.body.ownerToken })).status, 200)
    assert.equal((await api({ action: 'manage', token: created.body.ownerToken })).status, 404)
    assert.equal((await api({ action: 'open', token: rotated.body.playToken })).status, 404)
    assert.equal(inspect(db => db.prepare('SELECT COUNT(*) AS count FROM shared_story_sessions WHERE story_id = ?').get(id)).count, 0)
  })
  await check('expiry cleans stories and cascades sessions; old usage buckets are purged', async () => {
    inspect(db => db.prepare('DELETE FROM shared_story_generation_limits').run())
    const expiry = await api({ action: 'create', brief }, handler, 'expiry-client')
    const opened = await api({ action: 'open', token: expiry.body.playToken })
    assert.equal(opened.status, 200)
    const storyId = expiry.body.playToken.split('.')[0]
    inspect(db => {
      db.prepare('UPDATE shared_stories SET expires_at = ? WHERE id = ?').run(new Date(now - 1).toISOString(), storyId)
      db.prepare("INSERT INTO shared_story_generation_limits VALUES ('day:2000-01-01:generate', 99), ('hour:2000-01-01-00:generate:old', 5)").run()
    })
    assert.equal((await api({ action: 'open', token: expiry.body.playToken })).status, 404)
    assert.equal((await api({ action: 'hint', token: expiry.body.playToken, sessionToken: opened.body.sessionToken })).status, 404)
    assert.equal(inspect(db => db.prepare('SELECT COUNT(*) AS count FROM shared_story_sessions WHERE story_id = ?').get(storyId)).count, 0)
    await storyRepository().reserve('cleanup', 'generate')
    assert.equal(inspect(db => db.prepare("SELECT COUNT(*) AS count FROM shared_story_generation_limits WHERE bucket LIKE '%2000-01-01%'").get()).count, 0)
  })
  await check('Vercel guard, unknown backend, filesystem and corrupt DB failures are explicit 503s', async () => {
    process.env.VERCEL = '1'
    const before = providerCalls
    assert.equal((await api({ action: 'create', brief })).status, 503)
    process.env.STORY_STORAGE = 'typo'
    assert.equal((await api({ action: 'create', brief })).status, 503)
    delete process.env.VERCEL
    process.env.STORY_STORAGE = 'sqlite'
    const blocker = path.join(output, 'blocker')
    fs.writeFileSync(blocker, 'not a directory')
    process.env.MUSE_SQLITE_PATH = path.join(blocker, 'db.sqlite')
    assert.equal((await api({ action: 'create', brief })).status, 503)
    const corrupt = path.join(output, 'corrupt.sqlite')
    fs.writeFileSync(corrupt, 'not sqlite data')
    process.env.MUSE_SQLITE_PATH = corrupt
    assert.equal((await api({ action: 'create', brief })).status, 503)
    assert.equal(providerCalls, before)
    process.env.MUSE_SQLITE_PATH = filename
  })
  console.log(`\n${passed} SQLite story checks passed.`)
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  global.fetch = fetch
  Date.now = realNow
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]
  Object.assign(process.env, env)
  fs.rmSync(output, { recursive: true, force: true })
})

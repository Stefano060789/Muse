const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync, spawn } = require('node:child_process')
const { createHash } = require('node:crypto')
const { DatabaseSync } = require('node:sqlite')

const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.sqlite-story-tests-'))
const env = { ...process.env }
const fetch = global.fetch
const realNow = Date.now
let now = Math.floor(realNow() / 3600000) * 3600000 + 60000
let passed = 0
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
  async function api(body, selected = handler, address = '127.0.0.1') {
    let status = 200
    let result
    const headers = {}
    const res = { setHeader: (key, value) => { headers[key] = value }, status: value => { status = value; return res }, json: value => { result = value; return res } }
    await selected({ method: 'POST', headers: { host: 'localhost:3000' }, socket: { remoteAddress: address }, body: { consentVersion: '2026-10-14', ...body } }, res)
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
      `)
      legacy.prepare('INSERT INTO shared_stories VALUES (?, ?, ?, ?, ?, ?, ?)').run('legacy', 'owner', 'play', JSON.stringify(brief), JSON.stringify(content), brief.solution, new Date(now + 86400000).toISOString())
      legacy.prepare('INSERT INTO shared_story_sessions VALUES (?, ?, ?, ?, ?, ?)').run('legacy', 'player', 1, 0, 2, null)
    } finally { legacy.close() }
    const repo = storyRepository()
    assert.equal((await repo.findUnexpired('legacy')).brief.solution, brief.solution)
    assert.deepEqual(await repo.advance('legacy', 'player', 'hint', ''), { current_scene: 1, solved: false, skipped: false, revealed_hints: 0 })
    assert.deepEqual(await storyRepository().advance('legacy', 'player', 'open', ''), { current_scene: 1, solved: false, skipped: false, revealed_hints: 0 })
    assert.equal(inspect(db => db.prepare('SELECT attempts FROM shared_story_sessions WHERE story_id = ?').get('legacy')).attempts, 2)
    assert.equal(inspect(db => db.prepare('SELECT alternative_answers_normalized FROM shared_stories WHERE id = ?').get('legacy')).alternative_answers_normalized, '[]')
  })
  await check('explicit SQLite creates schema without Supabase credentials and keeps capabilities hashed', async () => {
    created = await api({ action: 'create', brief })
    assert.equal(created.status, 201)
    id = created.body.ownerToken.split('.')[0]
    assert.notEqual(created.body.ownerToken, created.body.playToken)
    const row = inspect(db => db.prepare('SELECT * FROM shared_stories WHERE id = ?').get(id))
    assert.equal(row.owner_hash, hash(created.body.ownerToken.split('.')[1]))
    assert.equal(row.play_hash, hash(created.body.playToken.split('.')[1]))
    assert.equal(row.answer_normalized, brief.solution)
    assert.ok(!JSON.stringify(row).includes(created.body.playToken.split('.')[1]))
    assert.equal((await api({ action: 'manage', token: created.body.ownerToken })).body.brief.solution, brief.solution)
  })
  await check('owner/play separation, wrong/correct answers, cooldown and persisted progress use actual API', async () => {
    for (const action of ['manage', 'delete', 'share']) assert.equal((await api({ action, token: created.body.playToken })).status, 404)
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

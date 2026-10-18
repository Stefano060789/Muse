const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash, randomUUID } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { Writable } = require('node:stream')
const { DatabaseSync } = require('node:sqlite')
const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.romance-access-tests-'))
const env = { ...process.env }
const savedFetch = global.fetch
const hash = value => createHash('sha256').update(value).digest('hex')
let address = 1
async function main() {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), 'src/pages/api/shared-story.ts',
    '--outDir', output, '--rootDir', 'src', '--module', 'commonjs', '--target', 'es2020',
    '--esModuleInterop', '--skipLibCheck', '--strict', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })
  process.env.STORY_STORAGE = 'sqlite'
  process.env.MUSE_SQLITE_PATH = path.join(output, 'stories.sqlite')
  process.env.MUSE_OPERATIONS_SQLITE_PATH = path.join(output, 'operations.sqlite')
  process.env.MUSE_MEDIA_PATH = path.join(output, 'media')
  process.env.MUSE_CREATOR_ACCESS_CODE = 'romance-fixture-creator-code'
  delete process.env.VERCEL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  let providerCalls = 0
  global.fetch = async () => { providerCalls++; throw new Error('No paid calls in access tests') }
  const handler = require(path.join(output, 'pages', 'api', 'shared-story.js')).default
  const { storyRepository } = require(path.join(output, 'lib', 'storyRepository.js'))
  const db = storyRepository()
  const sessionToken = 'c'.repeat(64)
  const base = {
    creatorName: 'PRIVATE_SENDER', recipientName: 'PRIVATE_RECIPIENT', narration: 'Warm',
    setting: 'PRIVATE_SETTING', recipientHints: '', goal: 'Find the invitation',
    solution: 'picnic', message: 'PRIVATE_REVEAL', durationMinutes: 5,
    unlockPolicy: 'allow-skip', assistanceHints: ['PRIVATE_HINT'], alternativeAnswers: [],
    gift: { occasion: 'anniversary', dedication: 'PRIVATE_DEDICATION', allowReply: true }
  }
  const content = {
    title: 'PRIVATE_TITLE', description: 'PRIVATE_DESCRIPTION', narrationStyle: 'warm', narrationLanguage: 'en-US',
    scenes: Array.from({ length: 3 }, () => ({ title: 'PRIVATE_SCENE', body: 'PRIVATE_BODY', clue: 'PRIVATE_CLUE' }))
  }
  async function api(body, owner = false) {
    const res = new Writable({ write(_chunk, _enc, callback) { callback() } })
    Object.assign(res, {
      statusCode: 200, body: undefined, setHeader() {},
      status(code) { res.statusCode = code; return res },
      json(value) { res.body = value; res.end(); return res }
    })
    await handler({
      method: 'POST', headers: { host: 'localhost:3000', ...(owner ? { 'x-muse-creator-code': process.env.MUSE_CREATOR_ACCESS_CODE } : {}) },
      socket: { remoteAddress: `10.91.0.${address++}` }, body: { consentVersion: '2026-10-18', ...body }
    }, res)
    return { status: res.statusCode, body: res.body }
  }
  async function insert(romance, language) {
    const id = randomUUID(), ownerKey = 'a'.repeat(64), playKey = 'b'.repeat(64)
    const brief = { ...base, ...(romance ? { romance } : {}), ...(language ? { language } : {}) }
    await db.insert({ id, owner_hash: hash(ownerKey), play_hash: hash(playKey), brief, content, answer_normalized: 'picnic', alternative_answers_normalized: [], expires_at: new Date(Date.now() + 86400000).toISOString() })
    return { id, brief, token: `${id}.${playKey}`, ownerToken: `${id}.${ownerKey}` }
  }
  for (const romance of ['sweet', 'spicy']) {
    const story = await insert(romance, 'ar-SA')
    for (const confirmation of [undefined, false, 'true', 1]) {
      const opened = await api({ action: 'open', token: story.token, sessionToken, romanceConfirmed: confirmation })
      assert.equal(opened.status, 200)
      assert.deepEqual(opened.body, { romanceNotice: { romance, language: 'ar-SA' } })
      assert.equal(JSON.stringify(opened.body).includes('PRIVATE'), false)
    }
    const connection = new DatabaseSync(process.env.MUSE_SQLITE_PATH)
    try { assert.equal(connection.prepare('SELECT COUNT(*) AS n FROM shared_story_sessions WHERE story_id = ?').get(story.id).n, 0, 'No recipient progress before opt-in') }
    finally { connection.close() }
    for (const action of ['next', 'guess', 'hint', 'skip', 'adventure', 'media', 'voice', 'reply']) {
      const rejected = await api({ action, token: story.token, sessionToken, guess: 'picnic', reply: 'Thanks', confirmSkip: true })
      assert.equal(rejected.status, 403, action)
      assert.equal(JSON.stringify(rejected.body).includes('PRIVATE'), false)
    }
    assert.equal((await api({ action: 'open', token: story.ownerToken })).status, 404, 'Owner token cannot bypass recipient capability')
    const managed = await api({ action: 'manage', token: story.ownerToken }, true)
    assert.equal(managed.status, 200)
    assert.equal(managed.body.content.title, 'PRIVATE_TITLE', 'Creator retains management access')
    const opened = await api({ action: 'open', token: story.token, sessionToken, romanceConfirmed: true })
    assert.equal(opened.status, 200)
    assert.equal(opened.body.player.title, 'PRIVATE_TITLE')
    assert.equal(opened.body.player.message, undefined)
    const solved = await api({ action: 'guess', token: story.token, sessionToken, guess: 'picnic', romanceConfirmed: true })
    assert.equal(solved.status, 200)
    assert.equal(solved.body.player.message, 'PRIVATE_REVEAL')
    for (const action of ['open', 'media', 'voice', 'reply']) {
      const recheck = await api({ action, token: story.token, sessionToken, reply: 'Thanks' })
      assert.equal(action === 'open' ? recheck.body.player : recheck.status, action === 'open' ? undefined : 403, 'Even solved sessions require explicit acknowledgment: ' + action)
    }
    const reply = await api({ action: 'reply', token: story.token, sessionToken, romanceConfirmed: true, reply: 'Thanks' })
    assert.equal(reply.status, 200)
    await db.rotate(story.id, hash('d'.repeat(64)))
    assert.equal((await api({ action: 'open', token: story.token })).status, 404)
  }
  console.log('PASS both romance styles return only localized notice metadata until explicit opt-in')
  console.log('PASS no pre-consent sessions, text, names, cover, reveal or media; all recipient actions gated even after solving')
  console.log('PASS capability validation, management, confirmed play/reply and rotation remain intact')
  const legacy = await insert()
  const legacyOpen = await api({ action: 'open', token: legacy.token })
  assert.equal(legacyOpen.status, 200)
  assert.ok(legacyOpen.body.player)
  for (const confirmation of [undefined, false, 'true', 1]) {
    const noConsent = await api({ action: 'create', brief: { ...base, romance: 'spicy', romanceConfirmed: true }, romanceConfirmed: confirmation }, true)
    assert.equal(noConsent.status, 400, 'Only a fresh top-level true confirmation authorizes creation')
  }
  assert.equal((await api({ action: 'create', brief: { ...base, romance: 'unsupported' }, romanceConfirmed: true }, true)).status, 400)
  const corrupt = await insert('unsupported')
  assert.equal((await api({ action: 'open', token: corrupt.token, romanceConfirmed: true })).status, 409, 'Malformed stored setting fails closed')
  assert.equal(providerCalls, 0)
  console.log('PASS legacy stories unchanged and unconfirmed romance creation rejected before paid calls')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  global.fetch = savedFetch
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]
  Object.assign(process.env, env)
  fs.rmSync(output, { recursive: true, force: true })
})

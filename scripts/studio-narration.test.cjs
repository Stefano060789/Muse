const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash, randomUUID } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { Writable } = require('node:stream')
const { DatabaseSync } = require('node:sqlite')
const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.studio-tests-'))
const savedEnv = { ...process.env }
const savedFetch = global.fetch
const hash = value => createHash('sha256').update(value).digest('hex')
let address = 1

async function main() {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), 'src/pages/api/shared-story.ts',
    '--outDir', output, '--rootDir', 'src', '--module', 'commonjs', '--target', 'es2020',
    '--esModuleInterop', '--skipLibCheck', '--strict', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })
  Object.assign(process.env, {
    STORY_STORAGE: 'sqlite', MUSE_SQLITE_PATH: path.join(output, 'stories.sqlite'),
    MUSE_MEDIA_PATH: path.join(output, 'media'), MUSE_OPERATIONS_SQLITE_PATH: path.join(output, 'operations.sqlite'),
    MUSE_CREATOR_ACCESS_CODE: 'studio-test-creator', ELEVEN_API_KEY: 'fake-no-paid-calls',
    ELEVEN_VOICE_ID: 'testVoice', MUSE_STUDIO_NARRATION_BUDGET_CHARACTERS: '100000'
  })
  delete process.env.VERCEL
  delete process.env.MUSE_STUDIO_NARRATION_ENABLED
  const handler = require(path.join(output, 'pages', 'api', 'shared-story.js')).default
  const { storyRepository } = require(path.join(output, 'lib', 'storyRepository.js'))
  const studio = require(path.join(output, 'lib', 'studioNarration.js'))
  const { LocalMediaStore } = require(path.join(output, 'lib', 'sharedMediaStore.js'))
  const db = storyRepository()
  const store = new LocalMediaStore()
  const sessionToken = 'c'.repeat(64)
  const ownerKey = 'a'.repeat(64), playKey = 'b'.repeat(64)
  const mp3 = Buffer.from('ID3fake-test-only-audio')
  let providerCalls = 0, mode = 'success', block, release
  const sentText = []
  global.fetch = async (url, options) => {
    assert.ok(url.startsWith('https://api.elevenlabs.io/v1/text-to-speech/testVoice?'))
    assert.equal(options.headers['xi-api-key'], 'fake-no-paid-calls')
    providerCalls++
    const request = JSON.parse(options.body)
    assert.deepEqual(Object.keys(request).sort(), ['model_id', 'text'])
    assert.equal(request.model_id, 'eleven_multilingual_v2')
    sentText.push(request.text)
    assert.ok(!JSON.stringify(request).includes('PRIVATE_'))
    if (block) await block
    if (mode === 'failure') return new Response('failed', { status: 500 })
    if (mode === 'invalid') return new Response('not audio', { headers: { 'Content-Type': 'audio/mpeg' } })
    if (mode === 'oversize') return new Response(Buffer.alloc(studio.STUDIO_MAX_BYTES + 1), { headers: { 'Content-Type': 'audio/mpeg' } })
    return new Response(mp3, { headers: { 'Content-Type': 'audio/mpeg' } })
  }
  async function api(body, creator = false) {
    const res = new Writable({ write(_chunk, _enc, callback) { callback() } })
    const headers = {}
    Object.assign(res, {
      statusCode: 200, body: undefined, setHeader(key, value) { headers[key] = value },
      status(code) { res.statusCode = code; return res },
      json(value) { res.body = value; res.end(); return res },
      send(value) { res.body = value; res.end(); return res }
    })
    await handler({
      method: 'POST', headers: { host: 'localhost:3000', ...(creator ? { 'x-muse-creator-code': process.env.MUSE_CREATOR_ACCESS_CODE } : {}) },
      socket: { remoteAddress: `10.92.${Math.floor(address / 250)}.${address++ % 250}` }, body
    }, res)
    return { status: res.statusCode, body: res.body, headers }
  }
  async function insert(extra = {}) {
    const id = randomUUID()
    const story = {
      id, owner_hash: hash(ownerKey), play_hash: hash(playKey),
      brief: {
        creatorName: 'PRIVATE_SENDER', recipientName: 'PRIVATE_RECIPIENT', narration: 'Warm', setting: 'PRIVATE_SETTING',
        recipientHints: 'PRIVATE_HINTS', goal: 'Find the invitation', solution: 'PRIVATE_ANSWER', message: 'PRIVATE_FINAL',
        durationMinutes: 5, ...extra
      },
      content: {
        title: 'Story title', description: 'Story description', narrationStyle: 'warm', narrationLanguage: 'en-US',
        scenes: Array.from({ length: 3 }, (_, i) => ({ title: `Scene ${i}`, body: `Body ${i}`, clue: `Clue ${i}` }))
      },
      answer_normalized: 'private_answer', expires_at: new Date(Date.now() + 86400000).toISOString()
    }
    await db.insert(story)
    return { ...story, token: `${id}.${playKey}`, ownerToken: `${id}.${ownerKey}` }
  }
  function sql(run) {
    const connection = new DatabaseSync(process.env.MUSE_SQLITE_PATH)
    try { return run(connection) } finally { connection.close() }
  }
  const status = story => api({ action: 'studio-status', token: story.ownerToken }, true)
  const generate = (story, sceneIndex = 0, consentVersion = '2026-10-14') =>
    api({ action: 'studio-generate', token: story.ownerToken, sceneIndex, consentVersion }, true)
  const audio = (story, sceneIndex = 0, extra = {}) =>
    api({ action: 'studio-audio', token: story.token, sessionToken, sceneIndex, ...extra })
  const first = await insert()
  assert.equal((await status(first)).body.studio.available, false)
  assert.equal((await generate(first)).status, 503)
  process.env.MUSE_STUDIO_NARRATION_ENABLED = 'TRUE'
  assert.equal((await generate(first)).status, 503)
  process.env.MUSE_STUDIO_NARRATION_ENABLED = 'true'
  for (const budget of ['', '0', '-1', '1.5', 'NaN', 'Infinity', '100000001', '1e4']) {
    process.env.MUSE_STUDIO_NARRATION_BUDGET_CHARACTERS = budget
    assert.equal((await generate(first)).status, 503)
  }
  process.env.MUSE_STUDIO_NARRATION_BUDGET_CHARACTERS = '100000'
  delete process.env.ELEVEN_API_KEY
  assert.equal((await generate(first)).status, 503)
  process.env.ELEVEN_API_KEY = 'fake-no-paid-calls'
  assert.equal((await api({ action: 'studio-generate', token: first.ownerToken, sceneIndex: 0 })).status, 401)
  assert.equal((await generate(first, 0, null)).status, 400)
  assert.equal((await api({ action: 'studio-generate', token: first.token, sceneIndex: 0, consentVersion: '2026-10-14' }, true)).status, 404)
  assert.equal((await api({ action: 'studio-status', token: first.token }, true)).status, 404)
  assert.equal(providerCalls, 0)
  for (const index of [-1, '0', 3, 1.1, null]) assert.equal((await generate(first, index)).status, 400)
  assert.throws(() => studio.studioScene({ ...first, content: { ...first.content, scenes: Array(13).fill(first.content.scenes[0]) } }, 0), /scene index/)
  assert.throws(() => studio.studioScene({ ...first, content: { ...first.content, scenes: [{ title: 'Scene', body: 'x'.repeat(5000), clue: 'Clue' }] } }, 0), /5000 characters/)
  const live = await insert({ adventure: { actionBudget: 3 } })
  assert.equal((await generate(live)).status, 409)
  assert.equal((await status(live)).body.studio.available, false)
  console.log('PASS disabled-by-default, strict config, creator/capability/consent and bounded scene contract')

  assert.equal((await generate(first)).status, 200)
  assert.equal(sentText[0], 'Scene 0\n\nBody 0\n\nClue 0')
  assert.equal(providerCalls, 1)
  assert.equal((await generate(first)).status, 200)
  assert.equal(providerCalls, 1)
  assert.equal((await status(first)).body.studio.scenes[0].status, 'ready')
  assert.equal((await audio(first)).status, 404, 'Audio must not create a recipient session')
  assert.equal((await api({ action: 'open', token: first.token, sessionToken })).status, 200)
  let played = await audio(first)
  assert.equal(played.status, 200)
  assert.deepEqual(played.body, mp3)
  assert.equal(played.headers['Cache-Control'], 'no-store')
  assert.equal(played.headers['Content-Type'], 'audio/mpeg')
  assert.equal((await audio(first, 0, { sessionToken: 'd'.repeat(64) })).status, 404)
  assert.equal((await audio(first, 0, { token: first.ownerToken })).status, 404)
  assert.equal((await api({ action: 'studio-audio', token: first.ownerToken, preview: true, sceneIndex: 0 })).status, 401)
  assert.equal((await api({ action: 'studio-audio', token: first.token, preview: true, sceneIndex: 0 }, true)).status, 404)
  assert.equal((await api({ action: 'studio-audio', token: first.ownerToken, preview: true, sceneIndex: 0 }, true)).status, 200)
  await generate(first, 1)
  assert.equal((await audio(first, 1)).status, 404, 'Future scene unavailable')
  await api({ action: 'next', token: first.token, sessionToken })
  assert.equal((await audio(first, 1)).status, 200)
  assert.equal((await audio(first, 0)).status, 200, 'Reached scenes replay freely')
  const beforeReplay = providerCalls
  delete process.env.MUSE_STUDIO_NARRATION_ENABLED
  delete process.env.ELEVEN_API_KEY
  assert.equal((await audio(first)).status, 200)
  assert.equal((await generate(first)).status, 200, 'Cache can be reused without provider enabled')
  assert.equal(providerCalls, beforeReplay)
  process.env.MUSE_STUDIO_NARRATION_ENABLED = 'true'
  process.env.ELEVEN_API_KEY = 'fake-no-paid-calls'
  assert.equal(await db.voiceReady(first.id), null, 'Studio never occupies gift voice slot')
  console.log('PASS private cached playback, no replay cost, owner preview and existing-session/progress gating')

  const romance = await insert({ romance: 'spicy' })
  await generate(romance)
  assert.equal((await audio(romance)).status, 403)
  await api({ action: 'open', token: romance.token, sessionToken, romanceConfirmed: true })
  assert.equal((await audio(romance, 0, { romanceConfirmed: true })).status, 200)
  assert.equal((await audio(romance)).status, 403, 'Gate rechecked on every audio request')
  await db.rotate(romance.id, hash('e'.repeat(64)))
  assert.equal((await audio(romance, 0, { romanceConfirmed: true })).status, 404)
  console.log('PASS romance acknowledgement and token rotation revoke recipient access')

  const concurrent = await insert()
  block = new Promise(resolve => { release = resolve })
  const active = generate(concurrent)
  while (!sentText.length || !(await db.studio({ operation: 'status', storyId: concurrent.id })).records.length) {
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  const callsAtReservation = providerCalls
  assert.equal((await generate(concurrent)).status, 409)
  release()
  block = null
  assert.equal((await active).status, 200)
  assert.equal(providerCalls, callsAtReservation)
  const used = () => Number(sql(c => c.prepare('SELECT used FROM muse_studio_budget WHERE id = 1').get()).used)
  process.env.MUSE_STUDIO_NARRATION_BUDGET_CHARACTERS = String(used())
  const budgeted = await insert()
  const beforeBudget = providerCalls
  assert.equal((await generate(budgeted)).status, 429)
  assert.equal(providerCalls, beforeBudget)
  assert.equal((await db.studio({ operation: 'status', storyId: budgeted.id })).records.length, 0)
  process.env.MUSE_STUDIO_NARRATION_BUDGET_CHARACTERS = '100000'
  for (const failedMode of ['failure', 'invalid', 'oversize']) {
    const failed = await insert()
    mode = failedMode
    const beforeUsed = used()
    assert.equal((await generate(failed)).status, 502)
    assert.ok(used() > beforeUsed, 'Failures remain charged')
    const calls = providerCalls
    assert.equal((await generate(failed)).status, 409)
    assert.equal(providerCalls, calls, 'Failed calls cannot be retried')
    assert.equal((await status(failed)).body.studio.scenes[0].status, 'failed')
  }
  mode = 'success'
  const storageFailed = await insert()
  const callsBeforeStorage = providerCalls
  await assert.rejects(studio.generateStudioScene(db, storageFailed, 0, {
    async ready() {}, async write() { throw new Error('Disk full') }
  }), /Studio storage failed/)
  assert.equal(providerCalls, callsBeforeStorage + 1)
  assert.equal((await generate(storageFailed)).status, 409, 'Storage failure must not cause a second paid call')
  const notReady = await insert()
  const callsBeforeReady = providerCalls
  await assert.rejects(studio.generateStudioScene(db, notReady, 0, {
    async ready() { throw new Error('Bucket unavailable') }
  }), /Bucket unavailable/)
  assert.equal(providerCalls, callsBeforeReady, 'Storage readiness is checked before reservation/provider')
  assert.equal((await status(notReady)).body.studio.scenes.length, 0)
  const exactCost = studio.studioScene(notReady, 0).text.length
  process.env.MUSE_STUDIO_NARRATION_BUDGET_CHARACTERS = String(used() + exactCost)
  const otherBudget = await insert()
  const parallelResults = await Promise.all([generate(notReady), generate(otherBudget)])
  assert.deepEqual(parallelResults.map(result => result.status).sort(), [200, 429], 'Only one concurrent story can consume the remaining budget')
  process.env.MUSE_STUDIO_NARRATION_BUDGET_CHARACTERS = '100000'
  console.log('PASS durable generation deduplication, atomic global budget and explicit non-retryable provider failures')

  const stale = await insert()
  const record = {
    story_id: stale.id, scene_index: 0, fingerprint: 'f'.repeat(64), object_key: `stories/${stale.id}/${randomUUID()}.mp3`,
    status: 'pending', characters: 25, size: 0, created_at: new Date().toISOString()
  }
  await db.studio({ operation: 'reserve', record, budget: 100000 })
  sql(c => c.prepare("UPDATE muse_studio_audio SET created_at = ? WHERE story_id = ?").run(new Date(Date.now() - 360000).toISOString(), stale.id))
  assert.equal((await status(stale)).body.studio.scenes[0].status, 'failed')
  assert.equal((await generate(stale)).status, 409)
  const beforeDeleteUsed = used()
  const deletedKeys = (await db.studio({ operation: 'status', storyId: first.id })).records.map(row => row.object_key)
  assert.equal((await api({ action: 'delete', token: first.ownerToken }, true)).status, 200)
  assert.equal((await audio(first)).status, 404)
  assert.equal((await status(first)).status, 404)
  assert.equal(used(), beforeDeleteUsed, 'Deleting stories cannot reset the budget')
  const deletedDuringWrite = await insert()
  let lateKey
  await assert.rejects(studio.generateStudioScene(db, deletedDuringWrite, 0, {
    async ready(mime) { await store.ready(mime) },
    async write(key, bytes, mime) {
      lateKey = key
      await db.delete(deletedDuringWrite.id)
      await store.write(key, bytes, mime)
    }
  }), /expired or story was deleted/)
  assert.ok(await store.read(lateKey, studio.STUDIO_MAX_BYTES), 'An in-flight write may finish after deletion')
  assert.equal((await api({ action: 'studio-audio', token: deletedDuringWrite.ownerToken, preview: true, sceneIndex: 0 }, true)).status, 404)
  sql(c => c.prepare('UPDATE muse_studio_purge SET retain_until = ?').run(new Date(Date.now() - 1000).toISOString()))
  await assert.rejects(studio.purgeStudioAudio(db, { async remove() { throw new Error('Storage offline') } }), /Storage offline/)
  assert.ok(sql(c => c.prepare('SELECT count(*) AS n FROM muse_studio_purge').get()).n > 0, 'Failed cleanup stays queued')
  await studio.purgeStudioAudio(db, store)
  assert.equal(sql(c => c.prepare('SELECT count(*) AS n FROM muse_studio_purge').get()).n, 0)
  for (const key of deletedKeys) assert.equal(await store.read(key, studio.STUDIO_MAX_BYTES), null, 'Purge removes private cached bytes')
  assert.equal(await store.read(lateKey, studio.STUDIO_MAX_BYTES), null, 'Grace-period purge removes late in-flight writes')
  const expired = await insert()
  await generate(expired)
  const expiredKey = (await db.studio({ operation: 'status', storyId: expired.id })).records[0].object_key
  sql(c => c.prepare('UPDATE muse_studio_audio SET created_at = ? WHERE story_id = ?').run(new Date(Date.now() - 360000).toISOString(), expired.id))
  sql(c => c.prepare('UPDATE shared_stories SET expires_at = ? WHERE id = ?').run(new Date(Date.now() - 1000).toISOString(), expired.id))
  assert.equal((await audio(expired)).status, 404)
  assert.equal(await store.read(expiredKey, studio.STUDIO_MAX_BYTES), null, 'Expired-link request itself sweeps eligible cached bytes')
  assert.equal((await api({ action: 'studio-audio', token: expired.ownerToken, preview: true, sceneIndex: 0 }, true)).status, 404)
  const deletedOnRequest = await insert()
  await generate(deletedOnRequest)
  const deletedOnRequestKey = (await db.studio({ operation: 'status', storyId: deletedOnRequest.id })).records[0].object_key
  sql(c => c.prepare('UPDATE muse_studio_audio SET created_at = ? WHERE story_id = ?').run(new Date(Date.now() - 360000).toISOString(), deletedOnRequest.id))
  assert.equal((await api({ action: 'delete', token: deletedOnRequest.ownerToken }, true)).status, 200)
  assert.equal(await store.read(deletedOnRequestKey, studio.STUDIO_MAX_BYTES), null, 'Delete request itself purges eligible bytes')
  const rotatedDuringRead = await insert()
  await generate(rotatedDuringRead)
  await api({ action: 'open', token: rotatedDuringRead.token, sessionToken })
  await assert.rejects(studio.readStudioAudio(db, rotatedDuringRead, 0, hash(sessionToken), {
    async read(key, cap) {
      const bytes = await store.read(key, cap)
      await db.rotate(rotatedDuringRead.id, hash('f'.repeat(64)))
      return bytes
    }
  }), /revoked/, 'Rotation during storage read revokes the in-flight response')
  const revoked = await insert()
  await generate(revoked)
  await api({ action: 'open', token: revoked.token, sessionToken })
  const revokedStore = {
    ...store, async read(key, cap) { const bytes = await store.read(key, cap); await db.delete(revoked.id); return bytes }
  }
  await assert.rejects(studio.readStudioAudio(db, revoked, 0, hash(sessionToken), revokedStore), /revoked/)
  console.log('PASS stale reservations, deletion/expiry revocation, post-read authorization and durable purge lifecycle')
  Object.assign(process.env, {
    NEXT_PUBLIC_NARRATION_PROVIDER: 'google', GOOGLE_TTS_API_KEY: 'fake-google-key-no-paid-calls',
    MUSE_GOOGLE_TTS_BUDGET_CHARACTERS: '100000', MUSE_GOOGLE_TTS_SQLITE_PATH: path.join(output, 'google-tts.sqlite'),
    MUSE_STUDIO_NARRATION_ENABLED: 'true'
  })
  let googleCalls = 0
  const googleMp3 = Buffer.alloc(192)
  googleMp3.set([0xff, 0xf3, 0x84, 0xc0])
  global.fetch = async (url, options) => {
    assert.ok(String(url).startsWith('https://texttospeech.googleapis.com/v1/text:synthesize'))
    const body = JSON.parse(options.body)
    assert.ok(!JSON.stringify(body).includes('PRIVATE_'), 'Google receives only prepared scene narration')
    assert.match(body.voice.name, /Wavenet/)
    assert.equal(body.audioConfig.audioEncoding, 'MP3')
    googleCalls++
    return new Response(JSON.stringify({ audioContent: googleMp3.toString('base64') }), { headers: { 'Content-Type': 'application/json' } })
  }
  const googleStory = await insert()
  assert.equal((await status(googleStory)).body.studio.available, true)
  assert.equal((await generate(googleStory)).status, 200)
  assert.equal(googleCalls, 1)
  await api({ action: 'open', token: googleStory.token, sessionToken })
  const googleAudio = await audio(googleStory)
  assert.equal(googleAudio.status, 200)
  assert.deepEqual(Buffer.from(googleAudio.body), googleMp3)
  assert.equal((await generate(googleStory)).status, 200)
  assert.equal(googleCalls, 1, 'Saved Google gift recordings replay without provider charges')
  assert.equal((await api({ action: 'studio-generate', token: googleStory.ownerToken, sceneIndex: 1, consentVersion: 'muse-ai-v1' })).status, 401, 'Recipients cannot authorize paid Google synthesis')
  console.log('PASS Google prepared gift synthesis, private cached replay and creator-only generation')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  global.fetch = savedFetch
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key]
  Object.assign(process.env, savedEnv)
  fs.rmSync(output, { recursive: true, force: true })
})

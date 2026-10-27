const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { Readable, Writable } = require('node:stream')
const { DatabaseSync } = require('node:sqlite')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.shared-gifting-tests-'))
const mediaRoot = path.join(output, 'private-media')
const dbFile = path.join(output, 'stories.sqlite')
const originalEnv = { ...process.env }
const originalFetch = global.fetch
const originalNow = Date.now
let now = Date.now()
let address = 1
let providerBrief
let passed = 0

async function check(name, run) {
  await run()
  passed++
  console.log(`PASS ${name}`)
}

function mockRes() {
  const chunks = []
  const res = new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback() } })
  Object.assign(res, {
    statusCode: 200, headers: {}, body: undefined,
    setHeader(key, value) { res.headers[key.toLowerCase()] = value },
    status(code) { res.statusCode = code; return res },
    json(value) { res.body = value; res.end(); return res },
    bytes() { return Buffer.concat(chunks) }
  })
  return res
}

function wav(seconds, sampleRate = 8000) {
  const dataBytes = seconds * sampleRate * 2
  const bytes = Buffer.alloc(44 + dataBytes)
  bytes.write('RIFF', 0, 'ascii')
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8, 'ascii')
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(sampleRate, 24)
  bytes.writeUInt32LE(sampleRate * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36, 'ascii')
  bytes.writeUInt32LE(dataBytes, 40)
  return bytes
}

function guestParticipantId(sessionToken) {
  const digest = require('node:crypto').createHash('sha256').update(sessionToken).digest('hex')
  const variant = ((parseInt(digest[16], 16) & 3) | 8).toString(16)
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-${variant}${digest.slice(17, 20)}-${digest.slice(20, 32)}`
}

async function main() {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/sharedStory.ts', 'src/lib/sharedStoryGenerator.ts', 'src/pages/api/shared-story.ts',
    'src/pages/api/shared-story-upload.ts',
    '--outDir', output, '--module', 'commonjs', '--target', 'es2020',
    '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })

  process.env.STORY_STORAGE = 'sqlite'
  process.env.MUSE_SQLITE_PATH = dbFile
  process.env.MUSE_MEDIA_PATH = mediaRoot
  process.env.LLM_PROVIDER = 'GROQ'
  process.env.LLM_API_KEY = 'fixture-not-a-secret'
  delete process.env.VERCEL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  Date.now = () => now

  const handler = require(path.join(output, 'pages', 'api', 'shared-story.js')).default
  const uploadHandler = require(path.join(output, 'pages', 'api', 'shared-story-upload.js')).default
  const { parseSharedStoryBrief, sceneCountForDuration } = require(path.join(output, 'lib', 'sharedStory.js'))
  const { parseWavDuration, validateVoiceBytes, SHARED_VOICE_MAX_BYTES } = require(path.join(output, 'lib', 'sharedStoryMedia.js'))
  const { storyRepository } = require(path.join(output, 'lib', 'storyRepository.js'))
  const { localMediaPath } = require(path.join(output, 'lib', 'sharedMediaStore.js'))

  const base = {
    creatorName: 'Alex', recipientName: 'Sam', narration: 'A playful mystery',
    setting: 'A quiet observatory with a locked drawer.', recipientHints: 'Sam likes the stars.',
    goal: 'Find the hidden note.', solution: 'under the blue book', message: 'A note just for you.',
    durationMinutes: 5, unlockPolicy: 'allow-skip'
  }
  const gift = { occasion: 'birthday', dedication: 'For Sam, with love.', allowReply: true }
  const content = {
    title: 'The Observatory', description: 'Follow the clues.',
    narrationStyle: 'curious', narrationLanguage: 'en-US',
    scenes: Array.from({ length: sceneCountForDuration(5) }, (_, index) => ({
      title: `Clue ${index + 1}`, body: Array(100).fill('wonder').join(' '), clue: 'Look near the telescope.'
    }))
  }
  global.fetch = async (_url, options) => {
    providerBrief = JSON.parse(JSON.parse(options.body).messages[1].content)
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200 })
  }

  await check('cooperative stories share one turn state and enforce signed-in round-robin turns', async () => {
    const cooperative = await api({
      action: 'create',
      brief: {
        ...base, gift,
        adventure: { actionBudget: 12, choiceMode: 'free', cooperative: true }
      }
    })
    assert.equal(cooperative.status, 201, JSON.stringify(cooperative.body))
    const storyId = cooperative.body.ownerToken.split('.')[0]
    const activity = await api({ action: 'activity' })
    assert.equal(activity.status, 200, JSON.stringify(activity.body))
    assert.deepEqual(Object.keys(activity.body.stories[0]).sort(), ['id', 'progress', 'title'])
    assert.equal(activity.body.stories[0].title, content.title)
    assert.equal(activity.body.stories[0].progress.opened, 0)
    const needsGuestName = await api({ action: 'open', token: cooperative.body.playToken })
    assert.equal(needsGuestName.status, 200)
    assert.equal(needsGuestName.body.requiresDisplayName, true)
    const guestId = guestParticipantId(needsGuestName.body.sessionToken)
    const opened = await api({
      action: 'open', token: cooperative.body.playToken, sessionToken: needsGuestName.body.sessionToken,
      displayName: 'Sam'
    })
    assert.equal(opened.status, 200, JSON.stringify(opened.body))
    assert.equal(opened.body.player.cooperative.isYourTurn, false, 'creator retains the first turn')
    assert.equal(opened.body.player.cooperative.currentTurnName, 'Alex')
    assert.deepEqual(opened.body.player.cooperative.members.map(member => member.displayName), ['Alex', 'Sam'])
    const repository = storyRepository()
    const second = await repository.cooperative({ storyId, userId: guestId, operation: 'view' })
    assert.equal(second.isYourTurn, false)
    assert.equal(second.currentTurnName, 'Alex')
    assert.deepEqual(second.members.map(member => member.displayName), ['Alex', 'Sam'])
    const story = await repository.findUnexpired(storyId)
    const sessionHash = require('node:crypto').createHash('sha256').update(`cooperative:${storyId}`).digest('hex')
    const turn = { narration: 'The observatory opens onto a shared path.', state: {
      inventory: ['A brass key'], discoveries: ['A star map'], relationships: ['A helpful keeper'], progress: 'The team found the key.'
    } }
    const makeRequest = (operation, userId, requestId, revision = 0) => ({
      storyId, sessionHash, playHash: story.play_hash, cooperativeUserId: userId, operation,
      cap: 1000, requestId, revision, fingerprint: String(requestId).padEnd(64, 'f').slice(0, 64)
    })
    await assert.rejects(() => repository.adventure(makeRequest('reserve', guestId, 'second-before-first')),
      /another participant.s turn/)
    const first = makeRequest('reserve', 'local-development', 'first-turn')
    assert.equal((await repository.adventure(first)).status, 'reserved')
    assert.equal((await repository.adventure({ ...first, operation: 'finish', turn })).status, 'done')
    const afterFirst = await repository.cooperative({ storyId, userId: guestId, operation: 'view' })
    assert.equal(afterFirst.isYourTurn, true)
    const secondTurn = makeRequest('reserve', guestId, 'second-turn', 1)
    assert.equal((await repository.adventure(secondTurn)).status, 'reserved')
    await repository.adventure({ ...secondTurn, operation: 'finish', turn: { ...turn, narration: 'The map now shows the next clue.' } })
    const afterSecond = await repository.cooperative({ storyId, userId: 'local-development', operation: 'view' })
    assert.equal(afterSecond.isYourTurn, true)
    const groupState = await repository.adventure({ ...makeRequest('view', 'local-development', 'view-state', 2), operation: 'view' })
    assert.equal(groupState.view.turn.state.progress, 'The team found the key.')
    await repository.cooperative({ storyId, userId: 'local-development', operation: 'pass', sessionHash })
    assert.equal((await repository.cooperative({ storyId, userId: guestId, operation: 'view' })).isYourTurn, true)
  })

  async function api(body) {
    const res = mockRes()
    await handler({
      method: 'POST',
      headers: { host: 'localhost:3000' },
      socket: { remoteAddress: `10.22.0.${address++}` },
      body: { consentVersion: '2026-10-18', ...body }
    }, res)
    return { status: res.statusCode, body: res.body, bytes: res.bytes(), headers: res.headers }
  }

  async function put(upload, bytes, { type, length } = {}) {
    const req = Readable.from([bytes])
    Object.assign(req, {
      method: 'PUT', socket: { remoteAddress: '127.0.0.1' },
      headers: {
        host: 'localhost:3000',
        'content-type': type ?? upload.headers['Content-Type'],
        'x-muse-upload': upload.headers['X-Muse-Upload'],
        'content-length': String(length ?? bytes.length)
      }
    })
    const res = mockRes()
    await uploadHandler(req, res)
    return { status: res.statusCode, body: res.body }
  }

  await check('gift input is optional but strict, bounded, and remains absent for legacy stories', async () => {
    const legacy = parseSharedStoryBrief(base)
    assert.equal(legacy.gift, undefined)
    assert.deepEqual(parseSharedStoryBrief({ ...base, gift }).gift, gift)
    for (const bad of [
      { ...gift, occasion: 'holiday' }, { ...gift, allowReply: 'yes' },
      { ...gift, dedication: 'x'.repeat(241) }, { ...gift, extra: true },
      { ...gift, dedication: base.solution }, { ...gift, dedication: base.message },
      { occasion: gift.occasion, dedication: gift.dedication },
      null, []
    ]) assert.throws(() => parseSharedStoryBrief({ ...base, gift: bad }))
  })

  let made, id, sessionToken, validVoice, staleVoiceKey
  await check('gift creation returns voice-null, keeps private gift metadata out of the AI prompt, and enforces owner/recipient capabilities', async () => {
    const badVoiceCreate = await api({
      action: 'create', brief: { ...base, gift }, finalVoice: { mime: 'audio/webm', size: 100 }
    })
    assert.equal(badVoiceCreate.status, 415, 'invalid final voice is rejected before generation')
    const voiceCannotReplaceMessage = await api({
      action: 'create', brief: { ...base, message: '', gift }, finalVoice: { mime: 'audio/wav', size: wav(1).length }
    })
    assert.equal(voiceCannotReplaceMessage.status, 400, 'voice alone does not replace the required written message')
    made = await api({
      action: 'create', brief: { ...base, message: '', gift },
      finalMedia: { mime: 'image/png', size: 128 }, finalVoice: { mime: 'audio/wav', size: wav(1).length }
    })
    assert.equal(made.status, 201, JSON.stringify(made.body))
    id = made.body.ownerToken.split('.')[0]
    assert.equal(made.body.voice, null)
    assert.deepEqual(made.body.brief.gift, gift)
    assert.equal(providerBrief.gift, undefined)
    assert.ok(!JSON.stringify(providerBrief).includes(gift.dedication))
    assert.ok(!JSON.stringify(providerBrief).includes('finalVoice'))
    assert.equal((await api({ action: 'manage', token: made.body.playToken })).status, 404)
    assert.equal((await api({ action: 'voice-start', token: made.body.playToken, voice: { mime: 'audio/wav', size: 44 } })).status, 404)
    assert.equal((await api({ action: 'reply', token: made.body.ownerToken, sessionToken: 'a'.repeat(64), reply: 'Hi' })).status, 404)
    assert.equal((await api({ action: 'manage', token: made.body.ownerToken })).body.replies.length, 0)
  })

  let photoBytes
  await check('photo and voice use independent slots and recipient projections reveal no voice bytes early', async () => {
    photoBytes = Buffer.alloc(128, 2)
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(photoBytes)
    const photoStart = await api({ action: 'media-start', token: made.body.ownerToken, media: { mime: 'image/png', size: photoBytes.length } })
    assert.equal(photoStart.status, 201)
    assert.equal((await put(photoStart.body.upload, photoBytes)).status, 200)
    assert.deepEqual((await api({ action: 'media-finish', token: made.body.ownerToken, uploadId: photoStart.body.uploadId })).body.media,
      { kind: 'photo', mime: 'image/png', size: photoBytes.length })

    const opened = await api({ action: 'open', token: made.body.playToken }, '')
    assert.equal(opened.status, 200)
    sessionToken = opened.body.sessionToken
    assert.deepEqual(opened.body.player.gift, gift)
    assert.equal(opened.body.player.voice, undefined)
    assert.equal(opened.body.player.media, undefined)
    assert.equal((await api({ action: 'voice', token: made.body.playToken, sessionToken }, '')).status, 403)
    assert.equal((await api({ action: 'reply', token: made.body.playToken, sessionToken, reply: 'Thanks!' }, '')).status, 403)
  })

  await check('voice declaration rejects spoofed types and oversize before storage, and duration is checked from PCM bytes', async () => {
    assert.equal((await api({ action: 'voice-start', token: made.body.ownerToken, voice: { mime: 'audio/webm', size: 100 } })).status, 415)
    assert.equal((await api({ action: 'voice-start', token: made.body.ownerToken, voice: { mime: 'audio/wav', size: SHARED_VOICE_MAX_BYTES + 1 } })).status, 413)
    assert.equal(parseWavDuration(wav(60)), 60)
    assert.throws(() => parseWavDuration(wav(61)), /60 seconds/)
    assert.deepEqual(validateVoiceBytes(wav(60)), {
      mime: 'audio/wav', size: wav(60).length, durationSeconds: 60
    })
    assert.throws(() => validateVoiceBytes(Buffer.from('not wav')), /complete WAV file/)
    assert.throws(() => validateVoiceBytes(Buffer.alloc(SHARED_VOICE_MAX_BYTES + 1)), /5\.0 MB/)

    const spoof = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(56).fill(0)])
    const spoofStart = await api({ action: 'voice-start', token: made.body.ownerToken, voice: { mime: 'audio/wav', size: spoof.length } })
    assert.equal(spoofStart.status, 201)
    assert.equal((await put(spoofStart.body.upload, spoof)).status, 200)
    assert.equal((await api({ action: 'voice-finish', token: made.body.ownerToken, uploadId: spoofStart.body.uploadId })).status, 415)

    const long = wav(61)
    const longStart = await api({ action: 'voice-start', token: made.body.ownerToken, voice: { mime: 'audio/wav', size: long.length } })
    assert.equal(longStart.status, 201)
    assert.equal((await put(longStart.body.upload, long)).status, 200)
    assert.equal((await api({ action: 'voice-finish', token: made.body.ownerToken, uploadId: longStart.body.uploadId })).status, 413)

    validVoice = wav(60)
    assert.ok(validVoice.length <= SHARED_VOICE_MAX_BYTES)
    const started = await api({ action: 'voice-start', token: made.body.ownerToken, voice: { mime: 'audio/wav', size: validVoice.length } })
    assert.equal(started.status, 201)
    assert.equal((await put(started.body.upload, validVoice)).status, 200)
    assert.deepEqual((await api({ action: 'voice-finish', token: made.body.ownerToken, uploadId: started.body.uploadId })).body.voice,
      { mime: 'audio/wav', size: validVoice.length })

    const repo = storyRepository()
    const previous = await repo.voiceReady(id)
    staleVoiceKey = previous.object_key
    const replacement = wav(1)
    const replacementStart = await api({ action: 'voice-start', token: made.body.ownerToken, voice: { mime: 'audio/wav', size: replacement.length } })
    assert.equal(replacementStart.status, 201)
    assert.equal((await put(replacementStart.body.upload, replacement)).status, 200)
    assert.equal((await api({ action: 'voice-finish', token: made.body.ownerToken, uploadId: replacementStart.body.uploadId })).status, 200)
    const database = new DatabaseSync(dbFile)
    try {
      assert.ok(database.prepare('SELECT 1 FROM shared_story_voice_purge WHERE object_key = ?').get(previous.object_key),
        'replaced voice object is queued for purge')
    } finally { database.close() }
    assert.ok(fs.existsSync(localMediaPath((await repo.mediaReady(id)).object_key)), 'photo slot remains intact')
    validVoice = replacement
  })

  await check('voice and replies require the same revealed recipient session; replies are bounded and idempotent', async () => {
    const other = await api({ action: 'open', token: made.body.playToken }, '')
    assert.equal((await api({ action: 'voice', token: made.body.playToken, sessionToken: other.body.sessionToken }, '')).status, 403)
    assert.equal((await api({ action: 'reply', token: made.body.playToken, sessionToken: other.body.sessionToken, reply: 'Thanks!' }, '')).status, 403)
    const skipped = await api({ action: 'skip', token: made.body.playToken, sessionToken, confirmSkip: true }, '')
    assert.equal(skipped.status, 200)
    assert.equal(skipped.body.player.skipped, true)
    assert.deepEqual(skipped.body.player.media, { kind: 'photo', mime: 'image/png' })
    assert.deepEqual(skipped.body.player.voice, { mime: 'audio/wav', size: validVoice.length })
    assert.deepEqual((await api({ action: 'voice', token: made.body.playToken, sessionToken }, '')).bytes, validVoice)
    assert.equal((await api({ action: 'reply', token: made.body.playToken, sessionToken, reply: 'x'.repeat(1001) }, '')).status, 400)
    assert.equal((await api({ action: 'reply', token: made.body.playToken, sessionToken, reply: '   ' }, '')).status, 400)

    const first = await api({ action: 'reply', token: made.body.playToken, sessionToken, reply: 'Thank you, Alex!' }, '')
    const retry = await api({ action: 'reply', token: made.body.playToken, sessionToken, reply: 'Thank you, Alex!' }, '')
    assert.equal(first.status, 200)
    assert.deepEqual(first.body, { sent: true })
    assert.deepEqual(retry.body, { sent: true })
    now += 1000
    const edited = await api({ action: 'reply', token: made.body.playToken, sessionToken, reply: 'I loved this!' }, '')
    assert.deepEqual(edited.body, { sent: true })
    const manage = await api({ action: 'manage', token: made.body.ownerToken })
    assert.deepEqual(manage.body.voice, { mime: 'audio/wav', size: validVoice.length })
    assert.deepEqual(manage.body.media, { kind: 'photo', mime: 'image/png', size: photoBytes.length })
    assert.deepEqual(manage.body.replies.map(reply => reply.message), ['I loved this!'])

    const repo = storyRepository()
    const database = new DatabaseSync(dbFile)
    try {
      for (let i = 0; i < 99; i++) {
        const hash = `reply-session-${String(i).padStart(4, '0')}`
        database.prepare('INSERT INTO shared_story_sessions(story_id, player_hash, solved) VALUES (?, ?, 1)').run(id, hash)
      }
    } finally { database.close() }
    for (let i = 0; i < 99; i++) await repo.giftReply(id, `reply-session-${String(i).padStart(4, '0')}`, `Reply ${i}`)
    const overflow = await api({ action: 'open', token: made.body.playToken }, '')
    await api({ action: 'skip', token: made.body.playToken, sessionToken: overflow.body.sessionToken, confirmSkip: true }, '')
    const overflowHash = require('node:crypto').createHash('sha256').update(overflow.body.sessionToken).digest('hex')
    await assert.rejects(() => repo.giftReply(id, overflowHash, 'One too many'), /100 replies/)
    const existingHash = require('node:crypto').createHash('sha256').update(sessionToken).digest('hex')
    await repo.giftReply(id, existingHash, 'Still updateable at the cap')
    assert.equal((await repo.giftReplies(id)).length, 100)

    const readyVoice = await repo.voiceReady(id)
    now = originalNow()
    assert.deepEqual((await api({ action: 'voice-delete', token: made.body.ownerToken })).body.voice, null)
    const purgeDb = new DatabaseSync(dbFile)
    try {
      assert.ok(purgeDb.prepare('SELECT 1 FROM shared_story_voice_purge WHERE object_key = ?').get(readyVoice.object_key),
        'deleted voice object remains queued if the cleanup clock has not caught up')
    } finally { purgeDb.close() }
    now = originalNow() + 5000
    const cleanupSweep = await api({ action: 'voice-start', token: made.body.ownerToken, voice: { mime: 'audio/wav', size: wav(1).length } })
    assert.equal(cleanupSweep.status, 201)
    assert.equal(fs.existsSync(localMediaPath(readyVoice.object_key)), false, 'deleted voice object is purged')
    assert.equal(fs.existsSync(localMediaPath(staleVoiceKey)), false, 'previously replaced voice object is purged')
    assert.equal((await api({ action: 'voice-cancel', token: made.body.ownerToken, uploadId: cleanupSweep.body.uploadId })).status, 200)
    const managedAfterVoiceDelete = await api({ action: 'manage', token: made.body.ownerToken })
    assert.deepEqual(managedAfterVoiceDelete.body.media, { kind: 'photo', mime: 'image/png', size: photoBytes.length })
  })

  await check('reply opt-out and stories without gift metadata preserve legacy recipient behavior; expiry cascades replies', async () => {
    const optOut = await api({ action: 'create', brief: { ...base, gift: { ...gift, allowReply: false } } })
    assert.equal(optOut.status, 201)
    const optOutOpen = await api({ action: 'open', token: optOut.body.playToken }, '')
    await api({ action: 'skip', token: optOut.body.playToken, sessionToken: optOutOpen.body.sessionToken, confirmSkip: true }, '')
    assert.equal((await api({ action: 'reply', token: optOut.body.playToken, sessionToken: optOutOpen.body.sessionToken, reply: 'Hello' }, '')).status, 403)

    const legacy = await api({ action: 'create', brief: base })
    assert.equal(legacy.status, 201)
    const legacyOpen = await api({ action: 'open', token: legacy.body.playToken }, '')
    assert.equal(legacyOpen.body.player.gift, undefined)
    assert.equal(legacyOpen.body.player.voice, undefined)
    assert.equal((await api({ action: 'reply', token: legacy.body.playToken, sessionToken: legacyOpen.body.sessionToken, reply: 'Hello' }, '')).status, 403)

    const database = new DatabaseSync(dbFile)
    try { database.prepare('UPDATE shared_stories SET expires_at = ? WHERE id = ?').run(new Date(now - 1000).toISOString(), id) }
    finally { database.close() }
    assert.equal((await api({ action: 'manage', token: made.body.ownerToken })).status, 404)
    assert.equal(await storyRepository().giftReplies(id).then(rows => rows.length), 0)
  })

  console.log(`PASS shared gifting backend: ${passed} focused checks`)
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  global.fetch = originalFetch
  Date.now = originalNow
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]
  Object.assign(process.env, originalEnv)
  fs.rmSync(output, { recursive: true, force: true })
})

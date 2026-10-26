const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { DatabaseSync } = require('node:sqlite')
const { createHash } = require('node:crypto')
const net = require('node:net')

const root = path.resolve(__dirname, '..')
const directory = fs.mkdtempSync(path.join(__dirname, '.sqlite-production-tests-'))
const filename = path.join(directory, 'stories.sqlite')
const preload = path.join(directory, 'offline.cjs')
fs.writeFileSync(preload, "global.fetch = async () => { throw new Error('External fetch forbidden in production storage smoke') }\n")
const hash = value => createHash('sha256').update(value).digest('hex')
let child
let logs = ''
function wav(seconds, sampleRate = 16000) {
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
async function stop() {
  if (!child || child.exitCode !== null) return
  const exited = new Promise(resolve => child.once('exit', resolve))
  child.kill()
  await exited
}
async function main() {
  const port = await new Promise(resolve => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)) })
  })
  const url = `http://127.0.0.1:${port}/api/shared-story`
  const api = async body => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consentVersion: '2026-10-18', ...body }) })
    return { status: response.status, body: await response.json() }
  }
  const id = '00000000-0000-0000-0000-000000000000'
  const key = 'a'.repeat(64)
  const token = `${id}.${key}`
  async function start() {
    child = spawn(process.execPath, ['--require', preload, path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
      cwd: root, env: { ...process.env, STORY_STORAGE: 'sqlite', MUSE_SQLITE_PATH: filename, MUSE_MEDIA_PATH: path.join(directory, 'media'), VERCEL: '' }, stdio: ['ignore', 'pipe', 'pipe']
    })
    child.stdout.on('data', value => { logs += value })
    child.stderr.on('data', value => { logs += value })
    for (let i = 0; i < 100; i++) {
      try { const result = await api({ action: 'open', token }); assert.equal(result.status, 404); return } catch (error) {
        if (child.exitCode !== null) throw new Error(logs)
        if (i === 99) throw error
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
  }
  await start()
  assert.ok(fs.existsSync(filename))
  const db = new DatabaseSync(filename)
  const brief = {
    creatorName: 'Alex', recipientName: 'Sam', message: 'Private reveal',
    assistanceHints: ['Private optional guidance', 'Second optional hint'],
    alternativeAnswers: ['approved equivalent'],
    gift: { occasion: 'surprise', dedication: 'For Sam, with love.', allowReply: true }
  }
  const content = { title: 'Smoke story', description: 'Test', narrationStyle: 'suspenseful', narrationLanguage: 'en-US', scenes: [{ title: 'One', body: 'First', clue: 'Clue' }, { title: 'Two', body: 'Second', clue: 'Clue' }] }
  db.prepare('INSERT INTO shared_stories (id, owner_hash, play_hash, brief, content, answer_normalized, alternative_answers_normalized, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, hash('b'.repeat(64)), hash(key), JSON.stringify(brief), JSON.stringify(content), 'answer', JSON.stringify(brief.alternativeAnswers), new Date(Date.now() + 86400000).toISOString())
  db.close()
  const opened = await api({ action: 'open', token })
  assert.equal(opened.status, 200)
  assert.equal(opened.body.player.narrationStyle, 'suspenseful')
  assert.equal(opened.body.player.narrationLanguage, 'en-US')
  assert.deepEqual(opened.body.player.gift, brief.gift)
  assert.equal(opened.body.player.voice, undefined)
  const sessionToken = opened.body.sessionToken
  assert.deepEqual(opened.body.player.revealedHints, [])
  assert.ok(!JSON.stringify(opened.body).includes(brief.alternativeAnswers[0]))
  const hinted = await api({ action: 'hint', token, sessionToken })
  assert.deepEqual(hinted.body.player.revealedHints, [brief.assistanceHints[0]])
  assert.equal(hinted.body.player.sceneIndex, 0)
  assert.ok(!JSON.stringify(hinted.body).includes(brief.assistanceHints[1]))
  assert.equal((await api({ action: 'next', token, sessionToken })).body.player.sceneIndex, 1)
  await stop()
  // The readiness probe expects a missing capability, not the seeded story.
  const probeDb = new DatabaseSync(filename)
  probeDb.prepare('UPDATE shared_stories SET play_hash = ? WHERE id = ?').run(hash('c'.repeat(64)), id)
  probeDb.close()
  await start()
  const persisted = await api({ action: 'open', token: `${id}.${'c'.repeat(64)}`, sessionToken })
  assert.equal(persisted.status, 200)
  assert.equal(persisted.body.player.sceneIndex, 1)
  assert.equal(persisted.body.player.narrationStyle, 'suspenseful')
  assert.deepEqual(persisted.body.player.revealedHints, [brief.assistanceHints[0]])
  // Real HTTP upload through the streaming route (body parser disabled) into private local storage.
  const ownerToken = `${id}.${'b'.repeat(64)}`
  const photo = Buffer.alloc(3000, 5)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(photo)
  const oversized = await api({ action: 'media-start', token: ownerToken, media: { mime: 'image/png', size: 100 } })
  const rejectedPut = await fetch(new URL(oversized.body.upload.url, url), { method: 'PUT', headers: oversized.body.upload.headers, body: photo })
  assert.equal(rejectedPut.status, 413)
  const started = await api({ action: 'media-start', token: ownerToken, media: { mime: 'image/png', size: photo.length } })
  assert.equal(started.status, 201)
  const put = await fetch(new URL(started.body.upload.url, url), { method: 'PUT', headers: started.body.upload.headers, body: photo })
  assert.equal(put.status, 200)
  assert.deepEqual((await api({ action: 'media-finish', token: ownerToken, uploadId: started.body.uploadId })).body.media, { kind: 'photo', mime: 'image/png', size: photo.length })
  const voice = wav(1)
  const voiceStarted = await api({ action: 'voice-start', token: ownerToken, voice: { mime: 'audio/wav', size: voice.length } })
  assert.equal(voiceStarted.status, 201)
  const voicePut = await fetch(new URL(voiceStarted.body.upload.url, url), {
    method: 'PUT', headers: voiceStarted.body.upload.headers, body: voice
  })
  assert.equal(voicePut.status, 200)
  assert.deepEqual((await api({ action: 'voice-finish', token: ownerToken, uploadId: voiceStarted.body.uploadId })).body.voice,
    { mime: 'audio/wav', size: voice.length })
  const manageBeforeReply = await api({ action: 'manage', token: ownerToken })
  assert.deepEqual(manageBeforeReply.body.voice, { mime: 'audio/wav', size: voice.length })
  assert.deepEqual(manageBeforeReply.body.replies, [])
  const locked = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'media', token: `${id}.${'c'.repeat(64)}`, sessionToken }) })
  assert.equal(locked.status, 403)
  assert.equal((await api({ action: 'voice', token: `${id}.${'c'.repeat(64)}`, sessionToken })).status, 403)
  assert.equal((await api({ action: 'reply', token: `${id}.${'c'.repeat(64)}`, sessionToken, reply: 'Thanks!' })).status, 403)
  const solved = await api({ action: 'guess', token: `${id}.${'c'.repeat(64)}`, sessionToken, guess: 'APPROVED equivalent!' })
  assert.equal(solved.body.player.solved, true)
  assert.equal(solved.body.player.message, brief.message)
  assert.deepEqual(solved.body.player.media, { kind: 'photo', mime: 'image/png' })
  assert.deepEqual(solved.body.player.voice, { mime: 'audio/wav', size: voice.length })
  const media = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'media', token: `${id}.${'c'.repeat(64)}`, sessionToken }) })
  assert.equal(media.status, 200)
  assert.equal(media.headers.get('content-type'), 'image/png')
  assert.equal(media.headers.get('cache-control'), 'no-store')
  assert.ok(Buffer.from(await media.arrayBuffer()).equals(photo))
  const voiceDelivery = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'voice', token: `${id}.${'c'.repeat(64)}`, sessionToken })
  })
  assert.equal(voiceDelivery.status, 200)
  assert.equal(voiceDelivery.headers.get('content-type'), 'audio/wav')
  assert.equal(voiceDelivery.headers.get('cache-control'), 'no-store')
  assert.ok(Buffer.from(await voiceDelivery.arrayBuffer()).equals(voice))
  assert.deepEqual((await api({
    action: 'reply', token: `${id}.${'c'.repeat(64)}`, sessionToken, reply: 'Thank you for the surprise!'
  })).body, { sent: true })
  const managedReply = await api({ action: 'manage', token: ownerToken })
  assert.deepEqual(managedReply.body.replies.map(({ message }) => message), ['Thank you for the surprise!'])
  assert.ok(Number.isFinite(Date.parse(managedReply.body.replies[0].createdAt)))
  await stop()
  await start()
  const giftManage = await api({ action: 'manage', token: ownerToken })
  assert.deepEqual(giftManage.body.voice, { mime: 'audio/wav', size: voice.length })
  assert.deepEqual(giftManage.body.replies.map(({ message }) => message), ['Thank you for the surprise!'])
  const persistedGiftPlayer = await api({ action: 'open', token: `${id}.${'c'.repeat(64)}`, sessionToken })
  assert.equal(persistedGiftPlayer.body.player.solved, true)
  assert.deepEqual(persistedGiftPlayer.body.player.voice, { mime: 'audio/wav', size: voice.length })
  console.log('PASS built Next HTTP SQLite initialization, private hints, restart durability, independent photo/WAV upload, locked/revealed voice access and opted-in reply persistence/manage (external fetch forbidden)')
}
main().catch(error => { console.error(error, logs); process.exitCode = 1 }).finally(async () => {
  await stop()
  fs.rmSync(directory, { recursive: true, force: true })
})

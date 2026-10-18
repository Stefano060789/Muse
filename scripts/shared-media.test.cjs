const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { Readable, Writable } = require('node:stream')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.shared-media-tests-'))
const env = { ...process.env }
const realFetch = global.fetch
const realNow = Date.now
let now = Math.floor(realNow() / 3600000) * 3600000 + 60000
let passed = 0
const CODE = 'fixture-code-not-a-real-secret'
const mediaRoot = path.join(output, 'private-media')

async function check(name, run) {
  await run()
  passed++
  console.log(`PASS ${name}`)
}

const png = size => { const b = Buffer.alloc(size, 7); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); return b }
const jpeg = size => { const b = Buffer.alloc(size, 3); Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(b); return b }
const webm = size => { const b = Buffer.alloc(size, 0); Buffer.from([0x1a, 0x45, 0xdf, 0xa3]).copy(b); b.write('webm', 24, 'ascii'); return b }
const mp4 = (size, brand = 'isom') => { const b = Buffer.alloc(size, 0); b.writeUInt32BE(24, 0); b.write('ftyp', 4, 'ascii'); b.write(brand, 8, 'ascii'); return b }

function mockRes() {
  const chunks = []
  const res = new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback() } })
  Object.assign(res, {
    statusCode: 200, headers: {}, body: undefined, headersSent: false,
    setHeader(key, value) { res.headers[key.toLowerCase()] = value },
    status(code) { res.statusCode = code; return res },
    json(value) { res.body = value; res.end(); return res },
    bytes() { return Buffer.concat(chunks) }
  })
  return res
}

async function main() {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/pages/api/shared-story.ts', 'src/pages/api/shared-story-upload.ts',
    '--outDir', output, '--module', 'commonjs', '--target', 'es2020',
    '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })
  process.env.STORY_STORAGE = 'sqlite'
  process.env.MUSE_SQLITE_PATH = path.join(output, 'db', 'stories.sqlite')
  process.env.MUSE_MEDIA_PATH = mediaRoot
  process.env.MUSE_CREATOR_ACCESS_CODE = CODE
  process.env.LLM_PROVIDER = 'GROQ'
  process.env.LLM_API_KEY = 'test-not-real'
  delete process.env.VERCEL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  Date.now = () => now
  const handler = require(path.join(output, 'pages', 'api', 'shared-story.js')).default
  const uploadHandler = require(path.join(output, 'pages', 'api', 'shared-story-upload.js')).default
  const { sceneCountForDuration } = require(path.join(output, 'lib', 'sharedStory.js'))
  const { localMediaRoot, SupabaseMediaStore } = require(path.join(output, 'lib', 'sharedMediaStore.js'))
  const { mediaSignatureMatches } = require(path.join(output, 'lib', 'sharedStoryMedia.js'))

  const baseBrief = {
    creatorName: 'Alex', recipientName: 'Sam', narration: 'Playful detective narration',
    setting: 'A room with a desk and stars painted on the ceiling.', recipientHints: 'Sam likes astronomy.',
    goal: 'Find the hidden letter.', solution: 'behind the blue notebook', message: '', durationMinutes: 5
  }
  const content = {
    title: 'The Room of Stars', description: 'Follow the familiar clues.', narrationStyle: 'suspenseful', narrationLanguage: 'en-US',
    scenes: Array.from({ length: sceneCountForDuration(5) }, (_, i) => ({
      title: `Discovery ${i + 1}`, body: Array(Math.ceil(350 / sceneCountForDuration(5))).fill('wonder').join(' '), clue: 'Look where the constellations were drawn.'
    }))
  }
  const prompts = []
  global.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.groq.com/openai/v1/chat/completions', 'Media handling must never fetch remote URLs')
    prompts.push(String(options.body))
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200 })
  }
  let address = 1
  const nextAddress = () => `10.0.0.${address++}`
  async function api(body, { code = CODE, ip = '127.0.0.1' } = {}) {
    const res = mockRes()
    await handler({ method: 'POST', headers: { host: 'localhost:3000', ...(code ? { 'x-muse-creator-code': code } : {}) }, socket: { remoteAddress: ip }, body: { consentVersion: '2026-10-18', ...body } }, res)
    assert.equal(res.headers['cache-control'], 'no-store')
    return { status: res.statusCode, body: res.body, bytes: res.bytes(), headers: res.headers }
  }
  async function put(target, bytes, { code = CODE, type, length, origin } = {}) {
    const req = Readable.from([bytes])
    Object.assign(req, {
      method: 'PUT', socket: { remoteAddress: '127.0.0.1' },
      headers: {
        host: 'localhost:3000', ...(origin ? { origin } : {}), ...(code ? { 'x-muse-creator-code': code } : {}),
        'content-type': type ?? target.headers['Content-Type'], 'x-muse-upload': target.headers['X-Muse-Upload'],
        ...(length === null ? {} : { 'content-length': String(length ?? bytes.length) })
      }
    })
    const res = mockRes()
    await uploadHandler(req, res)
    return { status: res.statusCode, body: res.body }
  }
  const create = async (brief, finalMedia) => api({ action: 'create', brief, ...(finalMedia ? { finalMedia } : {}) }, { ip: nextAddress() })
  const start = (story, media, ip = nextAddress()) => api({ action: 'media-start', token: story.ownerToken, media }, { ip })
  const finish = (story, uploadId) => api({ action: 'media-finish', token: story.ownerToken, uploadId })
  const attach = async (story, bytes, mime) => {
    const started = await start(story, { mime, size: bytes.length })
    assert.equal(started.status, 201, JSON.stringify(started.body))
    assert.equal((await put(started.body.upload, bytes)).status, 200)
    return finish(story, started.body.uploadId)
  }
  const files = () => fs.existsSync(mediaRoot) ? fs.readdirSync(mediaRoot, { recursive: true }).map(String).filter(name => /\.(png|jpg|webp|mp4|webm)(\.part)?$/.test(name)) : []
  const storyFiles = story => files().filter(name => name.includes(story.ownerToken.split('.')[0]))

  await check('byte signatures accept only the declared formats and reject lookalikes', async () => {
    assert.ok(mediaSignatureMatches(png(16), 'image/png'))
    assert.ok(mediaSignatureMatches(jpeg(16), 'image/jpeg'))
    assert.ok(mediaSignatureMatches(webm(64), 'video/webm'))
    assert.ok(mediaSignatureMatches(mp4(32), 'video/mp4'))
    assert.ok(!mediaSignatureMatches(png(16), 'image/jpeg'))
    assert.ok(!mediaSignatureMatches(mp4(32, 'heic'), 'video/mp4'), 'HEIC must not pass as MP4')
    assert.ok(!mediaSignatureMatches(mp4(32, 'qt  '), 'video/mp4'), 'QuickTime must not pass as MP4')
    const riff = Buffer.alloc(16); riff.write('RIFF', 0); riff.write('WAVE', 8)
    assert.ok(!mediaSignatureMatches(riff, 'image/webp'))
    const matroska = Buffer.alloc(64); Buffer.from([0x1a, 0x45, 0xdf, 0xa3]).copy(matroska); matroska.write('matroska', 24)
    assert.ok(!mediaSignatureMatches(matroska, 'video/webm'))
    assert.throws(() => localMediaRootWith(path.join(root, 'public', 'media')), /outside the public folder/)
  })
  function localMediaRootWith(value) {
    const previous = process.env.MUSE_MEDIA_PATH
    process.env.MUSE_MEDIA_PATH = value
    const log = console.error
    console.error = () => {}
    try { return localMediaRoot() } finally { console.error = log; process.env.MUSE_MEDIA_PATH = previous }
  }

  await check('invalid declarations and empty reveals are rejected before any paid AI call', async () => {
    const cases = [
      [{ mime: 'image/png', size: 5 * 1024 * 1024 + 1 }, 413],
      [{ mime: 'video/mp4', size: 20 * 1024 * 1024 + 1 }, 413],
      [{ mime: 'image/gif', size: 100 }, 415],
      [{ mime: 'image/heic', size: 100 }, 415],
      [{ mime: 'image/png', size: 0 }, 400],
      [{ mime: 'image/png', size: 1.5 }, 400],
      [{ mime: 'image/png', size: 100, url: 'https://evil.example/x.png' }, 400],
      [{ mime: 'image/png', size: 100, name: 'IMG_0001.png' }, 400]
    ]
    for (const [finalMedia, status] of cases) assert.equal((await create(baseBrief, finalMedia)).status, status, JSON.stringify(finalMedia))
    assert.equal((await create(baseBrief)).status, 400, 'A story needs a message or a photo/video')
    assert.equal((await create({ ...baseBrief, message: 'Hi' }, null)).status, 201)
    assert.equal(prompts.length, 1, 'Only the valid text story reached the provider')
    assert.equal((await api({ action: 'create', brief: baseBrief, finalMedia: { mime: 'image/png', size: 10 } }, { code: '' })).status, 401)
    assert.equal(prompts.length, 1)
  })

  await check('confirmed skip unlocks private media only for its own opted-in playthrough without AI calls', async () => {
    const made = await create({ ...baseBrief, unlockPolicy: 'allow-skip' }, { mime: 'image/png', size: 128 })
    assert.equal(made.status, 201)
    const story = made.body
    const bytes = png(128)
    assert.equal((await attach(story, bytes, 'image/png')).status, 200)
    const token = story.playToken
    const sessionToken = (await api({ action: 'open', token }, { code: '' })).body.sessionToken
    const before = prompts.length
    assert.equal((await api({ action: 'media', token, sessionToken }, { code: '' })).status, 403)
    assert.equal((await api({ action: 'skip', token, sessionToken }, { code: '' })).status, 400)
    const skipped = await api({ action: 'skip', token, sessionToken, confirmSkip: true }, { code: '' })
    assert.equal(skipped.status, 200)
    assert.equal(skipped.body.player.skipped, true)
    assert.equal(skipped.body.player.solved, false)
    const media = await api({ action: 'media', token, sessionToken }, { code: '' })
    assert.equal(media.status, 200)
    assert.deepEqual(media.bytes, bytes)
    const otherSession = (await api({ action: 'open', token }, { code: '' })).body.sessionToken
    assert.equal((await api({ action: 'media', token, sessionToken: otherSession }, { code: '' })).status, 403)
    assert.equal(prompts.length, before)
    await api({ action: 'delete', token: story.ownerToken })
  })
  let photoStory
  await check('media-only story generation never sends media metadata to the AI and waits for the attachment', async () => {
    const created = await create(baseBrief, { mime: 'image/png', size: 4321 })
    assert.equal(created.status, 201)
    assert.equal(created.body.mediaRequired, true)
    assert.equal(created.body.media, null)
    photoStory = created.body
    const prompt = prompts.at(-1)
    for (const leaked of ['image/png', '4321', 'finalMedia', 'photo', 'mime']) assert.ok(!prompt.includes(leaked), `AI prompt must not include ${leaked}`)
    assert.equal((await api({ action: 'open', token: photoStory.playToken }, { code: '' })).status, 409, 'Recipients wait until the creator attaches the reveal')
    const managed = await api({ action: 'manage', token: photoStory.ownerToken })
    assert.equal(managed.body.mediaRequired, true)
    assert.equal(managed.body.media, null)
  })

  let photoBytes
  await check('upload sessions are bound to the creator, story, secret, exact type and exact size', async () => {
    photoBytes = png(4321)
    const other = (await create({ ...baseBrief, message: 'Other story' })).body
    assert.equal((await api({ action: 'media-start', token: photoStory.playToken, media: { mime: 'image/png', size: 4321 } }, { code: '' })).status, 401, 'Recipients cannot start uploads')
    assert.equal((await api({ action: 'media-start', token: photoStory.playToken, media: { mime: 'image/png', size: 4321 } })).status, 404, 'A recipient token is not an owner token')
    assert.equal((await api({ action: 'media-start', token: photoStory.ownerToken, media: { mime: 'image/png', size: 4321 } }, { code: 'wrong-code-wrong-code' })).status, 401)
    const started = await start(photoStory, { mime: 'image/png', size: 4321 })
    assert.equal(started.status, 201)
    const target = started.body.upload
    assert.equal(target.url, '/api/shared-story-upload')
    assert.ok(!JSON.stringify(started.body).includes('stories/'), 'Object keys are never exposed to the browser')
    assert.equal((await put(target, photoBytes, { code: '' })).status, 401, 'Uploads require the creator code')
    assert.equal((await put(target, photoBytes, { origin: 'https://evil.example' })).status, 403)
    assert.equal((await put({ headers: { ...target.headers, 'X-Muse-Upload': target.headers['X-Muse-Upload'].slice(0, -1) + (target.headers['X-Muse-Upload'].endsWith('0') ? '1' : '0') } }, photoBytes)).status, 404, 'Wrong upload secret')
    assert.equal((await put(target, photoBytes, { type: 'image/jpeg' })).status, 415)
    assert.equal((await put(target, Buffer.concat([photoBytes, Buffer.alloc(10)]), { length: null })).status, 413, 'Streams larger than declared are cut off')
    assert.equal((await put(target, photoBytes.subarray(0, 100), { length: null })).status, 400, 'Short uploads are rejected')
    assert.equal(storyFiles(photoStory).length, 0, 'Rejected uploads leave no partial files')
    assert.equal((await finish(other, started.body.uploadId)).status, 404, "Another story's owner cannot claim this upload")
    assert.equal((await finish(photoStory, started.body.uploadId)).status, 409, 'Finishing before the file arrives keeps the session for a retry')
    assert.equal((await put(target, photoBytes)).status, 200)
    assert.equal((await put(target, photoBytes)).status, 409, 'An upload cannot be overwritten')
    const finished = await finish(photoStory, started.body.uploadId)
    assert.equal(finished.status, 200)
    assert.deepEqual(finished.body.media, { kind: 'photo', mime: 'image/png', size: 4321 })
    assert.equal((await finish(photoStory, started.body.uploadId)).status, 404, 'Upload sessions are single-use')
    assert.equal((await put(target, photoBytes)).status, 404, 'Used upload links stop working')
    const stored = storyFiles(photoStory)
    assert.equal(stored.length, 1)
    assert.ok(path.resolve(mediaRoot, stored[0]).startsWith(path.resolve(mediaRoot)))
    assert.ok(!path.relative(path.join(root, 'public'), path.resolve(mediaRoot, stored[0])).match(/^[^.]/), 'Stored outside public/')
  })

  await check('unsolved recipients never get media; solved sessions get only their story bytes, never autoplay metadata', async () => {
    const opened = await api({ action: 'open', token: photoStory.playToken }, { code: '' })
    assert.equal(opened.status, 200)
    const session = opened.body.sessionToken
    assert.equal(opened.body.player.media, undefined)
    assert.equal(opened.body.player.message, undefined)
    const other = await api({ action: 'open', token: photoStory.playToken }, { code: '' })
    for (const sessionToken of [session, other.body.sessionToken, undefined, 'f'.repeat(64)]) {
      const denied = await api({ action: 'media', token: photoStory.playToken, ...(sessionToken ? { sessionToken } : {}) }, { code: '' })
      assert.equal(denied.status, sessionToken === undefined ? 400 : 403)
      assert.equal(denied.bytes.length, 0)
    }
    assert.equal((await api({ action: 'media', token: photoStory.ownerToken, sessionToken: session }, { code: '' })).status, 404, 'Owner token is not a player token')
    const wrong = await api({ action: 'guess', token: photoStory.playToken, sessionToken: session, guess: 'under the bed' }, { code: '' })
    assert.equal(wrong.body.player.media, undefined)
    assert.equal((await api({ action: 'media', token: photoStory.playToken, sessionToken: session }, { code: '' })).status, 403)
    now += 60 * 1000
    const solved = await api({ action: 'guess', token: photoStory.playToken, sessionToken: session, guess: 'Behind the blue notebook!' }, { code: '' })
    assert.equal(solved.status, 200, JSON.stringify(solved.body))
    assert.equal(solved.body.player.solved, true)
    assert.deepEqual(solved.body.player.media, { kind: 'photo', mime: 'image/png' })
    assert.equal(solved.body.player.message, undefined, 'No empty message is revealed')
    assert.ok(!JSON.stringify(solved.body).includes('stories/'))
    const media = await api({ action: 'media', token: photoStory.playToken, sessionToken: session }, { code: '' })
    assert.equal(media.status, 200)
    assert.ok(media.bytes.equals(photoBytes))
    assert.equal(media.headers['content-type'], 'image/png')
    assert.equal(media.headers['x-content-type-options'], 'nosniff')
    assert.match(media.headers['content-security-policy'], /sandbox/)
    assert.equal(media.headers['cross-origin-resource-policy'], 'same-origin')
    assert.equal((await api({ action: 'media', token: photoStory.playToken, sessionToken: other.body.sessionToken }, { code: '' })).status, 403, 'Another unsolved session stays locked')
    const preview = await api({ action: 'media-preview', token: photoStory.ownerToken })
    assert.ok(preview.bytes.equals(photoBytes))
    assert.equal((await api({ action: 'media-preview', token: photoStory.playToken }, { code: '' })).status, 401)
    assert.equal((await api({ action: 'media-preview', token: photoStory.playToken })).status, 404, 'Owner preview needs the owner token')
    const rotated = await api({ action: 'share', token: photoStory.ownerToken })
    assert.equal((await api({ action: 'media', token: photoStory.playToken, sessionToken: session }, { code: '' })).status, 404, 'Rotated recipient links lose media access')
    photoStory.playToken = rotated.body.playToken
  })

  await check('mismatched bytes are removed, replacement deletes the old object, and the reveal stays consistent', async () => {
    const before = storyFiles(photoStory)
    const started = await start(photoStory, { mime: 'image/jpeg', size: 2000 })
    assert.equal((await put(started.body.upload, png(2000))).status, 200)
    const rejected = await finish(photoStory, started.body.uploadId)
    assert.equal(rejected.status, 415)
    assert.deepEqual(storyFiles(photoStory), before, 'Spoofed file deleted; previous photo kept')
    assert.deepEqual((await api({ action: 'manage', token: photoStory.ownerToken })).body.media, { kind: 'photo', mime: 'image/png', size: 4321 })
    const replaced = await attach(photoStory, webm(3000), 'video/webm')
    assert.equal(replaced.status, 200)
    assert.deepEqual(replaced.body.media, { kind: 'video', mime: 'video/webm', size: 3000 })
    const after = storyFiles(photoStory)
    assert.equal(after.length, 1)
    assert.ok(after[0].endsWith('.webm'))
    assert.ok(!before.some(name => after.includes(name)), 'Replaced photo is deleted')
    const cancelled = await start(photoStory, { mime: 'video/mp4', size: 500 })
    assert.equal((await put(cancelled.body.upload, mp4(500))).status, 200)
    assert.equal((await api({ action: 'media-cancel', token: photoStory.ownerToken, uploadId: cancelled.body.uploadId })).status, 200)
    assert.deepEqual(storyFiles(photoStory), after, 'Cancelled upload is deleted')
  })

  await check('upload windows expire explicitly and abandoned uploads are purged', async () => {
    const story = (await create({ ...baseBrief, message: 'Text first' })).body
    const late = await start(story, { mime: 'image/png', size: 100 })
    now += 16 * 60 * 1000
    assert.equal((await put(late.body.upload, png(100))).status, 410)
    assert.equal((await finish(story, late.body.uploadId)).status, 410)
    assert.equal((await finish(story, late.body.uploadId)).status, 404)
    const abandoned = await start(story, { mime: 'image/png', size: 100 })
    assert.equal((await put(abandoned.body.upload, png(100))).status, 200)
    assert.equal(storyFiles(story).length, 1)
    now += 21 * 60 * 1000
    await create({ ...baseBrief, message: 'Any later request sweeps abandoned uploads' })
    assert.equal(storyFiles(story).length, 0, 'Abandoned pending upload deleted')
    assert.equal((await finish(story, abandoned.body.uploadId)).status, 404)
  })

  await check('per-story attempts and per-connection upload rate are capped', async () => {
    const story = (await create({ ...baseBrief, message: 'Limits' })).body
    const ip = nextAddress()
    for (let i = 0; i < 6; i++) assert.equal((await start(story, { mime: 'image/png', size: 100 }, ip)).status, 201)
    const exhausted = await start(story, { mime: 'image/png', size: 100 }, ip)
    assert.equal(exhausted.status, 429)
    assert.match(exhausted.body.error, /6 upload attempts/)
    const second = (await create({ ...baseBrief, message: 'Rate' })).body
    for (let i = 0; i < 3; i++) assert.equal((await start(second, { mime: 'image/png', size: 100 }, ip)).status, 201)
    const limited = await start(second, { mime: 'image/png', size: 100 }, ip)
    assert.equal(limited.status, 429, 'Ten upload starts per connection per hour')
    assert.ok(!/attempts/.test(limited.body.error))
    assert.equal(storyFiles(story).length + storyFiles(second).length, 0)
  })

  await check('removing media blocks media-only playback; message+media and legacy text stories still work', async () => {
    assert.equal((await api({ action: 'media-delete', token: photoStory.ownerToken })).status, 200)
    assert.equal(storyFiles(photoStory).length, 0, 'Removed media is deleted from storage')
    assert.equal((await api({ action: 'open', token: photoStory.playToken }, { code: '' })).status, 409)
    const both = (await create({ ...baseBrief, message: 'Look at this photo!' }, { mime: 'image/jpeg', size: 800 })).body
    assert.equal((await attach(both, jpeg(800), 'image/jpeg')).status, 200)
    const legacy = (await create({ ...baseBrief, message: 'Only words.' })).body
    for (const [story, media] of [[both, { kind: 'photo', mime: 'image/jpeg' }], [legacy, undefined]]) {
      const opened = await api({ action: 'open', token: story.playToken }, { code: '' })
      assert.equal(opened.status, 200)
      assert.equal(opened.body.player.message, undefined)
      now += 60 * 1000
      const solved = await api({ action: 'guess', token: story.playToken, sessionToken: opened.body.sessionToken, guess: 'behind the blue notebook' }, { code: '' })
      assert.equal(solved.body.player.message, story === both ? 'Look at this photo!' : 'Only words.')
      assert.deepEqual(solved.body.player.media, media)
      const delivered = await api({ action: 'media', token: story.playToken, sessionToken: opened.body.sessionToken }, { code: '' })
      assert.equal(delivered.status, media ? 200 : 404)
      if (media) assert.ok(delivered.bytes.equals(jpeg(800)))
    }
    assert.equal((await api({ action: 'delete', token: both.ownerToken })).status, 200)
    assert.equal(storyFiles(both).length, 0, 'Deleting the story deletes its media')
  })

  await check('permanent stories keep media after 31 days and manual deletion still purges objects', async () => {
    const story = (await create({ ...baseBrief, message: 'A lasting gift' }, { mime: 'video/mp4', size: 900 })).body
    assert.equal((await attach(story, mp4(900), 'video/mp4')).status, 200)
    assert.equal(storyFiles(story).length, 1)
    now += 31 * 24 * 60 * 60 * 1000
    assert.equal(story.expiresAt, null)
    assert.equal((await api({ action: 'media-preview', token: story.ownerToken })).status, 200)
    await create({ ...baseBrief, message: 'A new day' })
    assert.equal(storyFiles(story).length, 1, 'Cleanup must not remove permanent story media')
    assert.equal((await api({ action: 'delete', token: story.ownerToken })).status, 200)
    assert.equal((await api({ action: 'media-preview', token: story.ownerToken })).status, 404)
    assert.equal(storyFiles(story).length, 0, 'Manual deletion still removes story media')
  })

  await check('Supabase store uses only signed URLs on the configured project and never exposes the service key', async () => {
    const calls = []
    let bucketPublic = false
    const object = Buffer.concat([png(64), Buffer.alloc(8000, 1)])
    global.fetch = async (url, options = {}) => {
      const location = new URL(String(url))
      assert.equal(location.origin, 'https://muse-test.supabase.co', 'No arbitrary remote fetch')
      calls.push({ path: location.pathname + location.search, method: options.method || 'GET', headers: options.headers })
      const json = value => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })
      if (location.pathname === '/storage/v1/bucket/muse-shared-media') return json({ id: 'muse-shared-media', public: bucketPublic })
      if (location.search.includes('download-token')) {
        assert.equal(new Headers(options.headers).get('range'), 'bytes=0-4095')
        assert.equal(options.redirect, 'error')
        return new Response(object.subarray(0, 4096), { status: 206 })
      }
      if (location.pathname.startsWith('/storage/v1/object/upload/sign/')) return json({ url: location.pathname.replace('/storage/v1', '') + '?token=upload-token' })
      if (location.pathname.startsWith('/storage/v1/object/sign/')) return json({ signedURL: location.pathname.replace('/storage/v1', '') + '?token=download-token' })
      if (location.pathname.startsWith('/storage/v1/object/info/')) return json({ id: 'x', name: 'x', size: object.length, content_type: 'image/png' })
      if (location.pathname === '/storage/v1/object/muse-shared-media' && options.method === 'DELETE') return json([])
      throw new Error(`Unexpected storage call ${location.pathname}`)
    }
    const store = new SupabaseMediaStore('https://muse-test.supabase.co', 'service-role-not-real')
    const key = 'stories/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png'
    const target = await store.createUpload({ id: '22222222-2222-4222-8222-222222222222', object_key: key, mime: 'image/png' }, 'unused')
    assert.match(target.url, /^https:\/\/muse-test\.supabase\.co\/storage\/v1\/object\/upload\/sign\/muse-shared-media\/stories\/.+\?token=upload-token$/)
    assert.equal(target.headers['x-upsert'], 'false')
    assert.ok(!JSON.stringify(target).includes('service-role-not-real'))
    const delivery = await store.deliver(key)
    assert.equal(delivery.type, 'url')
    assert.match(delivery.url, /\/storage\/v1\/object\/sign\/muse-shared-media\/.+token=download-token/)
    assert.ok(!delivery.url.includes('service-role-not-real'))
    assert.ok(Date.parse(delivery.expiresAt) - Date.now() <= 600 * 1000)
    const signCall = calls.find(call => call.path.startsWith('/storage/v1/object/sign/'))
    assert.ok(signCall)
    const stat = await store.stat(key)
    assert.equal(stat.size, object.length)
    assert.equal(stat.contentType, 'image/png')
    assert.ok(mediaSignatureMatches(stat.head, 'image/png'))
    await store.remove([key])
    assert.ok(calls.some(call => call.method === 'DELETE'))
    await assert.rejects(() => store.remove(['../../etc/passwd']), /Invalid private media reference/)
    bucketPublic = true
    await assert.rejects(() => store.ready(), /keep the Muse media bucket private/)
    await assert.rejects(() => store.createUpload({ object_key: key, mime: 'image/png' }), /keep the Muse media bucket private/)
  })
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  Date.now = realNow
  global.fetch = realFetch
  process.env = env
  fs.rmSync(output, { recursive: true, force: true })
  if (!process.exitCode) console.log(`\n${passed} Shared media checks passed.`)
})
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync, spawn } = require('node:child_process')
const { DatabaseSync } = require('node:sqlite')
const root = path.resolve(__dirname, '..')
const output = path.join(__dirname, `.google-tests-${process.pid}`)
const savedEnv = { ...process.env }, savedFetch = global.fetch
const frame = Buffer.alloc(192)
frame.set([0xff, 0xf3, 0x84, 0xc0]) // MPEG2 Layer III, 64kbps, 24kHz, mono.
const response = audio => Response.json({ audioContent: audio.toString('base64') })
let tests = 0

async function main() {
  fs.mkdirSync(output)
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), 'src/pages/api/tts.ts',
    '--outDir', output, '--rootDir', 'src', '--module', 'commonjs', '--target', 'es2020',
    '--esModuleInterop', '--skipLibCheck', '--strict', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })
  const google = require(path.join(output, 'lib', 'googleNarration.js'))
  const { SharedStoryError } = require(path.join(output, 'lib', 'sharedStory.js'))
  let calls = 0, attempts = 0, requests = []
  function reset(name = 'main', cap = '1000000') {
    delete process.env.VERCEL
    delete process.env.MUSE_GOOGLE_TTS_PERSISTENT_STORAGE
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    Object.assign(process.env, {
      STORY_STORAGE: 'sqlite',
      NEXT_PUBLIC_NARRATION_PROVIDER: 'google', GOOGLE_TTS_API_KEY: 'private-test-key',
      MUSE_GOOGLE_TTS_BUDGET_CHARACTERS: cap, MUSE_GOOGLE_TTS_SQLITE_PATH: path.join(output, `${name}.sqlite`)
    })
    global.fetch = async (url, options) => {
      calls++
      assert.equal(url, 'https://texttospeech.googleapis.com/v1/text:synthesize')
      assert.equal(options.headers['X-Goog-Api-Key'], 'private-test-key')
      assert.ok(options.signal)
      const body = JSON.parse(options.body)
      assert.deepEqual(Object.keys(body.input), ['text'])
      assert.equal(body.audioConfig.audioEncoding, 'MP3')
      assert.ok(Buffer.byteLength(body.input.text, 'utf8') <= 5000)
      requests.push(body)
      return response(frame)
    }
  }
  async function rejects(fn, code, status) {
    await assert.rejects(fn, error => {
      assert.ok(error instanceof SharedStoryError)
      assert.equal(error.code, code)
      if (status) assert.equal(error.status, status)
      assert.ok(!String(error).includes('private-test-key'))
      return true
    })
    tests++
  }
  function used() {
    const db = new DatabaseSync(process.env.MUSE_GOOGLE_TTS_SQLITE_PATH)
    try { return db.prepare('SELECT used FROM google_tts_budget').get().used } finally { db.close() }
  }
  const synth = (text, language = 'en-US', style = 'warm') =>
    google.synthesizeGoogleNarration(text, language, style, { reserveAttempt: async () => { attempts++ } })
  reset()
  delete process.env.NEXT_PUBLIC_NARRATION_PROVIDER
  assert.equal(google.googleNarrationConfiguration().reason, 'disabled')
  await rejects(() => synth('disabled'), 'google-not-configured', 503)
  reset()
  delete process.env.GOOGLE_TTS_API_KEY
  assert.equal(google.googleNarrationConfiguration().reason, 'missing-key')
  await rejects(() => synth('disabled'), 'google-not-configured')
  for (const cap of ['', '0', '-1', '1.5', 'Infinity', '9007199254740992', '1e4', ' 100']) {
    reset('main', cap)
    assert.equal(google.googleNarrationConfiguration().available, false)
    await rejects(() => synth('disabled'), 'google-not-configured')
  }
  reset()
  assert.equal(google.googleNarrationConfiguration().retentionDays, 30)
  process.env.VERCEL = '1'
  assert.equal(google.googleNarrationConfiguration().reason, 'hosted-storage-required')
  await rejects(() => synth('ephemeral storage'), 'google-not-configured')
  process.env.MUSE_GOOGLE_TTS_PERSISTENT_STORAGE = 'true'
  assert.equal(google.googleNarrationConfiguration().available, false)
  process.env.MUSE_GOOGLE_TTS_SQLITE_PATH = 'relative.sqlite'
  assert.equal(google.googleNarrationConfiguration().reason, 'hosted-storage-required')
  delete process.env.MUSE_GOOGLE_TTS_SQLITE_PATH
  assert.equal(google.googleNarrationConfiguration().reason, 'hosted-storage-required')
  reset()
  for (const [language, expected] of Object.entries({
    'en-US': 'en-US-Wavenet-F', 'zh-CN': 'cmn-CN-Wavenet-A', 'cmn-CN': 'cmn-CN-Wavenet-A',
    'hi-IN': 'hi-IN-Wavenet-A', 'es-ES': 'es-ES-Wavenet-F', 'ar-SA': 'ar-XA-Wavenet-A',
    'ar-XA': 'ar-XA-Wavenet-A', 'it-IT': 'it-IT-Wavenet-E', 'fr-FR': 'fr-FR-Wavenet-F',
    'de-DE': 'de-DE-Wavenet-G', 'ja-JP': 'ja-JP-Wavenet-A', 'pt-BR': 'pt-BR-Wavenet-A'
  })) assert.equal(google.googleVoice(language, 'warm').name, expected)
  assert.equal(google.googleVoice('en-US', 'calm').speakingRate, 0.95)
  assert.equal(google.googleVoice('en-US', 'playful').pitch, 0.5)
  await rejects(() => synth('hello', 'en-GB'), 'google-unsupported-voice', 400)
  await rejects(() => synth('hello', 'constructor'), 'google-unsupported-voice')
  await rejects(() => synth('hello', 'en-US', 'invalid'), 'google-unsupported-voice')
  for (const text of [undefined, {}, '', '  ', 'a'.repeat(12001), '\ud800', '\udc00', 'bad\u0000text']) {
    await rejects(() => synth(text), 'google-invalid-text', 400)
  }
  assert.equal(calls, 0)
  reset('unicode', '12000')
  const text = '你好世界。🙂 '.repeat(1500)
  const audio = await synth(text, 'zh-CN')
  assert.ok(audio instanceof Uint8Array)
  assert.deepEqual(Buffer.from(audio), Buffer.concat(requests.map(() => frame)))
  assert.equal(requests.map(r => r.input.text).join(''), text)
  assert.ok(requests.length > 3)
  assert.equal(used(), Array.from(text).length)
  const previousCalls = calls, previousAttempts = attempts
  assert.deepEqual(Buffer.from(await synth(text, 'zh-CN')), Buffer.from(audio))
  assert.equal(calls, previousCalls)
  assert.equal(attempts, previousAttempts)
  // No source text or credentials appear in database metadata.
  {
    const db = new DatabaseSync(process.env.MUSE_GOOGLE_TTS_SQLITE_PATH)
    const row = db.prepare('SELECT hash,status,expires FROM google_tts_audio').get()
    assert.match(row.hash, /^[a-f0-9]{64}$/)
    assert.ok(!JSON.stringify(row).includes('你好'))
    db.close()
  }
  reset('cap', '3')
  await synth('🙂中a')
  assert.equal(used(), 3)
  await rejects(() => synth('b'), 'google-budget-exhausted', 429)
  assert.equal(used(), 3)
  reset('concurrent')
  let release
  const wait = new Promise(resolve => { release = resolve })
  const fetchSuccess = global.fetch
  global.fetch = async (...args) => { await wait; return fetchSuccess(...args) }
  const pending = synth('same concurrent text')
  await rejects(() => synth('same concurrent text'), 'google-request-pending', 409)
  release()
  await pending
  assert.equal(used(), 'same concurrent text'.length)
  // Independent processes share the same atomic lifetime cap.
  reset('multiprocess', '4')
  const modulePath = path.join(output, 'lib', 'googleNarration.js')
  const child = text => new Promise((resolve, reject) => {
    const code = `global.fetch=async()=>Response.json({audioContent:${JSON.stringify(frame.toString('base64'))}});
      require(${JSON.stringify(modulePath)}).synthesizeGoogleNarration(${JSON.stringify(text)},'en-US','warm')
      .then(()=>console.log('ok')).catch(e=>console.log(e.code));`
    const process = spawn(processExec(), ['-e', code], { env: { ...global.process.env }, cwd: root })
    let result = '', error = ''
    process.stdout.on('data', chunk => { result += chunk })
    process.stderr.on('data', chunk => { error += chunk })
    process.on('error', reject)
    process.on('exit', code => code ? reject(new Error(error)) : resolve(result.trim()))
  })
  function processExec() { return global.process.execPath }
  const results = await Promise.all([child('abcd'), child('efgh')])
  assert.deepEqual(results.sort(), ['google-budget-exhausted', 'ok'])
  assert.equal(used(), 4)
  reset('failure')
  global.fetch = async () => { calls++; return new Response('secret provider diagnostic private-test-key', { status: 429 }) }
  await rejects(() => synth('private source story'), 'google-provider-failure', 503)
  assert.equal(used(), 'private source story'.length)
  const failedCalls = calls
  await rejects(() => synth('private source story'), 'google-request-failed', 409)
  assert.equal(calls, failedCalls)
  for (const [name, mock, expected] of [
    ['network', async () => { throw new Error('private-test-key private text') }, 'google-provider-failure'],
    ['json', async () => new Response('bad', { headers: { 'Content-Type': 'application/json' } }), 'google-invalid-audio'],
    ['mime', async () => new Response('bad', { headers: { 'Content-Type': 'audio/mpeg' } }), 'google-invalid-audio'],
    ['base64', async () => Response.json({ audioContent: '!!!!' }), 'google-invalid-audio'],
    ['padding', async () => Response.json({ audioContent: 'AB==' }), 'google-invalid-audio'],
    ['empty', async () => response(Buffer.alloc(0)), 'google-invalid-audio'],
    ['fake', async () => response(Buffer.from('ID3not-really-mp3')), 'google-invalid-audio'],
    ['truncated', async () => response(frame.subarray(0, 100)), 'google-invalid-audio'],
    ['oversize', async () => new Response('x'.repeat(8 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } }), 'google-audio-too-large']
  ]) {
    reset(name)
    global.fetch = mock
    await rejects(() => synth(`private source ${name}`), expected)
    await rejects(() => synth(`private source ${name}`), 'google-request-failed')
  }
  reset('timeout')
  const setTimer = global.setTimeout
  global.setTimeout = (callback, ms, ...args) => {
    assert.equal(ms, 60000)
    return setTimer(callback, 10, ...args)
  }
  global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('private timeout diagnostic')), { once: true })
  })
  try { await rejects(() => synth('bounded timeout'), 'google-provider-failure') } finally { global.setTimeout = setTimer }
  await rejects(() => synth('bounded timeout'), 'google-request-failed')
  reset('attempt-rejected')
  await rejects(() => google.synthesizeGoogleNarration('no attempt left', 'en-US', 'warm', {
    reserveAttempt: async () => { throw new SharedStoryError('Daily AI limit reached.', 429) }
  }), undefined, 429)
  await rejects(() => synth('no attempt left'), 'google-request-failed')
  reset('tags')
  const tag = Buffer.from([73, 68, 51, 4, 0, 0, 0, 0, 0, 0])
  global.fetch = async () => response(Buffer.concat([tag, frame]))
  assert.deepEqual(Buffer.from(await synth('test tags')), frame)
  reset('seek-tags')
  const seekFrame = Buffer.from(frame)
  seekFrame.write('Info', 13, 'ascii')
  global.fetch = async () => response(Buffer.concat([seekFrame, frame]))
  assert.deepEqual(Buffer.from(await synth('test seek metadata')), frame)
  reset('incompatible')
  let chunk = 0
  global.fetch = async () => {
    const other = Buffer.from(frame)
    if (chunk++) other[3] = 0
    return response(other)
  }
  await rejects(() => synth('long '.repeat(1500)), 'google-invalid-audio')
  reset('retention')
  await synth('expired')
  {
    const db = new DatabaseSync(process.env.MUSE_GOOGLE_TTS_SQLITE_PATH)
    db.prepare('UPDATE google_tts_audio SET expires=0').run()
    db.close()
  }
  await synth('expired')
  assert.equal(used(), 14)
  reset('different')
  await synth('same', 'en-US', 'warm')
  await synth('same', 'en-US', 'calm')
  await synth('same', 'hi-IN', 'warm')
  assert.equal(used(), 12)
  reset('storage')
  process.env.MUSE_GOOGLE_TTS_SQLITE_PATH = output // A directory cannot be a sqlite database.
  await rejects(() => synth('fail closed'), 'google-storage-unavailable')
  reset('api')
  Object.assign(process.env, {
    MUSE_OPERATIONS_SQLITE_PATH: path.join(output, 'operations.sqlite'),
    STORY_STORAGE: 'sqlite'
  })
  delete process.env.VERCEL
  const handler = require(path.join(output, 'pages', 'api', 'tts.js')).default
  const { PROVIDER_CONSENT_VERSION } = require(path.join(output, 'lib', 'providerConsent.js'))
  let address = 1
  async function api(body, method = 'POST') {
    const headers = {}
    const res = {
      statusCode: 200, body: null,
      setHeader(key, value) { headers[key] = value },
      status(code) { this.statusCode = code; return this },
      json(body) { this.body = body; return this },
      send(body) { this.body = body; return this }
    }
    await handler({
      method, headers: { host: 'localhost:3000' },
      socket: { remoteAddress: `10.93.0.${address++}` }, body
    }, res)
    return { status: res.statusCode, body: res.body, headers }
  }
  const body = { text: 'API cache test', narrationLanguage: 'en-US', narrationStyle: 'warm', consentVersion: PROVIDER_CONSENT_VERSION }
  assert.equal((await api(body, 'GET')).status, 405)
  assert.equal((await api({ ...body, consentVersion: undefined })).status, 400)
  const beforeApi = calls
  const first = await api(body)
  assert.equal(first.status, 200)
  assert.equal(first.headers['Content-Type'], 'audio/mpeg')
  assert.equal(first.headers['Cache-Control'], 'no-store')
  assert.deepEqual(first.body, frame)
  assert.equal((await api(body)).status, 200)
  assert.equal(calls, beforeApi + 1)
  {
    const db = new DatabaseSync(process.env.MUSE_OPERATIONS_SQLITE_PATH)
    const counters = db.prepare("SELECT used FROM muse_operations_counters WHERE bucket LIKE 'ai:%'").all()
    assert.equal(counters.length, 1)
    assert.equal(counters[0].used, 1)
    db.close()
  }
  assert.equal((await api({ ...body, narrationLanguage: 'xx-XX' })).body.code, 'google-unsupported-voice')
  process.env.NEXT_PUBLIC_NARRATION_PROVIDER = 'elevenlabs'
  process.env.ELEVEN_API_KEY = 'test-eleven-key'
  process.env.ELEVEN_VOICE_ID = 'test-voice'
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.elevenlabs.io/v1/text-to-speech/test-voice')
    assert.equal(options.headers['xi-api-key'], 'test-eleven-key')
    assert.equal(JSON.parse(options.body).model_id, 'eleven_multilingual_v2')
    return new Response(frame, { headers: { 'Content-Type': 'audio/mpeg' } })
  }
  assert.equal((await api(body)).status, 200)
  reset('hosted')
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: 'https://muse-test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-private',
    STORY_STORAGE: 'supabase', VERCEL: '1', MUSE_GOOGLE_TTS_BUDGET_CHARACTERS: '20'
  })
  process.env.STORY_STORAGE = 'sqlite'
  assert.equal(google.googleNarrationConfiguration().reason, 'hosted-storage-required')
  process.env.STORY_STORAGE = 'supabase'
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  assert.equal(google.googleNarrationConfiguration().reason, 'hosted-storage-required')
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-private'
  assert.equal(google.googleNarrationConfiguration().storage, 'supabase')
  assert.equal(google.googleNarrationConfiguration().available, true)
  const rows = new Map()
  let hostedUsed = 0, hostedCalls = 0, rpcCalls = 0, rpcFailure = false, providerFailure = false
  global.fetch = async (input, init) => {
    const url = String(input)
    const payload = JSON.parse(init.body)
    if (url.startsWith('https://texttospeech.googleapis.com/')) {
      hostedCalls++
      if (providerFailure) throw new Error('private-test-key')
      return response(frame)
    }
    assert.equal(url, 'https://muse-test.supabase.co/rest/v1/rpc/muse_google_narration')
    rpcCalls++
    const headers = new Headers(init.headers)
    assert.equal(headers.get('apikey'), 'test-service-role-private')
    assert.ok(init.signal)
    assert.ok(!init.body.includes('hosted text'))
    if (rpcFailure) return Response.json({ message: 'migration missing private-service-role' }, { status: 404 })
    const row = rows.get(payload.p_hash)
    if (payload.p_action === 'reserve') {
      if (row?.status === 'ready') return Response.json({ status: 'ready', audio: row.audio })
      if (row) return Response.json({ status: row.status })
      if (payload.p_characters > payload.p_limit - hostedUsed) return Response.json({ status: 'exhausted' })
      hostedUsed += payload.p_characters
      rows.set(payload.p_hash, { status: 'pending', token: payload.p_token })
      return Response.json({ status: 'reserved' })
    }
    assert.equal(row.token, payload.p_token)
    assert.equal(row.status, 'pending')
    row.status = payload.p_action === 'finish' ? 'ready' : 'failed'
    row.audio = payload.p_audio
    return Response.json({ status: 'saved' })
  }
  assert.deepEqual(Buffer.from(await synth('hosted text')), frame)
  assert.equal(hostedUsed, 11)
  const hostedAttempts = attempts
  assert.deepEqual(Buffer.from(await synth('hosted text')), frame)
  assert.equal(attempts, hostedAttempts)
  assert.equal(hostedCalls, 1)
  assert.equal(hostedUsed, 11)
  assert.equal(fs.existsSync(process.env.MUSE_GOOGLE_TTS_SQLITE_PATH), false)
  await rejects(() => synth('too much hosted text'), 'google-budget-exhausted')
  rpcFailure = true
  await rejects(() => synth('migration'), 'google-storage-unavailable')
  assert.equal(hostedCalls, 1)
  rpcFailure = false
  providerFailure = true
  await rejects(() => synth('failure'), 'google-provider-failure')
  await rejects(() => synth('failure'), 'google-request-failed')
  assert.equal(hostedCalls, 2)
  assert.equal(hostedUsed, 18)
  assert.ok(rpcCalls > 5)
  // Both callers represent independent serverless workers sharing the same hosted ledger.
  process.env.MUSE_GOOGLE_TTS_BUDGET_CHARACTERS = '100'
  providerFailure = false
  const duplicate = await Promise.allSettled([synth('parallel hosted'), synth('parallel hosted')])
  assert.equal(duplicate.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(duplicate.find(r => r.status === 'rejected').reason.code, 'google-request-pending')
  assert.equal(hostedUsed, 33)
  const sql = fs.readFileSync(path.join(root, 'supabase', 'google-narration.sql'), 'utf8')
  assert.match(sql, /WHERE id=1 FOR UPDATE/)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/g)
  assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/)
  assert.match(sql, /v_row\.token<>p_token/)
  assert.match(sql, /134217728/)
  console.log(`Google narration: ${tests} error checks plus configuration, voices, Unicode chunking, MP3 validation, atomic cross-process caps, cache, retention and privacy passed; no provider calls.`)
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  global.fetch = savedFetch
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key]
  Object.assign(process.env, savedEnv)
  fs.rmSync(output, { recursive: true, force: true })
})

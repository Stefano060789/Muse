const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-runway-test-'))
const environment = { ...process.env }
const oldFetch = global.fetch
class SharedStoryError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}
function load(file, mocks, cache = new Map()) {
  if (cache.has(file)) return cache.get(file)
  const module = { exports: {} }
  cache.set(file, module.exports)
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
  new Function('module', 'exports', 'require', code)(module, module.exports, id => {
    if (id in mocks) return mocks[id]
    return id.startsWith('.') ? load(path.join(path.dirname(file), id + '.ts'), mocks, cache) : require(id)
  })
  cache.set(file, module.exports)
  return module.exports
}
async function main() {
  Object.assign(process.env, {
    STORY_STORAGE: 'sqlite', MUSE_RUNWAY_SQLITE_PATH: path.join(temporary, 'runway.sqlite'),
    MUSE_RUNWAY_SHARING_ENABLED: 'true', RUNWAYML_API_SECRET: 'fixture-private-key',
    MUSE_RUNWAY_BUDGET_CREDITS: '1000', MUSE_RUNWAY_ACCOUNT_DAILY_CAP: '2'
  })
  delete process.env.VERCEL
  let globalCapDenied = false
  const mocks = {
    './sharedStory': { SharedStoryError },
    './storyRepository': { storyStorageMode: () => process.env.STORY_STORAGE },
    './operations': { reserveAiAttempt: async () => {
      if (globalCapDenied) throw new SharedStoryError('Global AI limit reached.', 429)
    } },
    '../../lib/sharedStory': { SharedStoryError }
  }
  const share = load('src/lib/runwayShare.ts', mocks)
  const store = load('src/lib/runwayShareStore.ts', mocks)
  const brief = load('src/lib/runwayShareBrief.ts', mocks)
  const copies = load('src/lib/runwayShareCopy.ts', mocks)
  let calls = [], providerFailure = false, generationFailure = false, hostile = false
  const taskId = crypto.randomUUID()
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(12)])
  global.fetch = async (url, options) => {
    calls.push({ url, options })
    if (providerFailure) throw new Error('PRIVATE UPSTREAM ERROR fixture-private-key')
    if (String(url).endsWith('/image_to_video')) return Response.json({ id: taskId })
    if (String(url).includes('/tasks/')) return Response.json({
      id: taskId, status: generationFailure ? 'FAILED' : 'SUCCEEDED',
      output: [hostile ? 'http://127.0.0.1/private' : 'https://dnznrvs05pmza.cloudfront.net/fixture.mp4?secret=fixture']
    })
    assert.equal(options.redirect, 'error')
    assert.ok(!options.headers?.Authorization, 'Runway credentials never go to the CDN')
    return new Response(mp4, { headers: { 'content-type': 'video/mp4' } })
  }
  const frame = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 1, 2, 0xff, 0xd9]).toString('base64')}`
  assert.ok(brief.validRunwayFrame(frame))
  assert.ok(!brief.validRunwayFrame('data:image/jpeg;base64,ZmFrZQ=='))
  assert.ok(!brief.validRunwayFrame('data:image/png;base64,ZmFrZQ=='))
  const request = (text, id = crypto.randomUUID()) => ({
    id, brief: text, frame, approved: true, approvedCredits: 16, consentVersion: brief.RUNWAY_SHARE_CONSENT,
    passage: 'PRIVATE PASSAGE', memories: ['PRIVATE MEMORY'], title: 'PRIVATE TITLE'
  })
  assert.equal(share.runwayQuote().estimatedUsd, 0.16)
  assert.equal(share.runwayQuote().credits, 16)
  assert.equal(share.runwayQuote().model, 'grok_imagine_1_5_lite')
  assert.equal(share.runwayQuote().ratio, 'auto_720p')
  assert.ok(!JSON.stringify(share.runwayQuote()).includes('fixture-private-key'))
  for (const language of ['en-US', 'it-IT', 'es-ES', 'zh-CN', 'hi-IN', 'uk-UA', 'ar-SA']) {
    assert.ok(Object.values(copies.runwayShareCopy(language)).every(value => value.trim()))
  }
  const map = brief.suggestedRunwayBrief('The Map of Forgotten Winds', 'A route appeared.')
  const sword = brief.suggestedRunwayBrief('Finding a sword', 'A blade appeared.')
  assert.match(map, /parchment map/)
  assert.match(sword, /silver sword/)
  assert.ok(!brief.suggestedRunwayBrief('PRIVATE NAME', 'PRIVATE ANSWER').includes('PRIVATE'))
  for (const invalid of [
    { ...request(map), approved: false }, { ...request(map), approvedCredits: 1 },
    { ...request(map), consentVersion: 'old' }, { ...request(map), brief: 'x'.repeat(901) },
    { ...request(map), id: '../../private' }, { ...request(map), frame: 'data:image/png;base64,AAAA' }
  ]) await assert.rejects(share.createRunwayJob('owner', invalid), SharedStoryError)
  assert.equal(calls.length, 0)
  process.env.MUSE_RUNWAY_SHARING_ENABLED = 'false'
  await assert.rejects(share.createRunwayJob('owner', request(map)), error => error.status === 503)
  assert.equal(calls.length, 0)
  process.env.MUSE_RUNWAY_SHARING_ENABLED = 'true'
  const input = request(map)
  const [first, repeated] = await Promise.all([share.createRunwayJob('owner', input), share.createRunwayJob('owner', input)])
  assert.equal(calls.filter(call => call.url.endsWith('/image_to_video')).length, 1, 'Concurrent submissions reserve exactly once')
  assert.ok(['submitted', 'unknown'].includes(first.status))
  assert.ok(['submitted', 'unknown'].includes(repeated.status))
  const payload = JSON.parse(calls[0].options.body)
  assert.deepEqual(payload, { model: 'grok_imagine_1_5_lite', promptText: map, promptImage: { uri: frame, position: 'first' }, duration: 5, ratio: 'auto_720p' })
  assert.ok(!JSON.stringify(payload).includes('PRIVATE'))
  assert.equal(calls[0].options.headers['X-Runway-Version'], '2024-11-06')
  assert.equal(calls[0].options.redirect, 'error')
  await assert.rejects(share.createRunwayJob('owner', { ...input, brief: sword }), error => error.status === 409)
  await assert.rejects(store.runwayJob('another-owner', input.id), error => error.status === 404)
  hostile = true
  await assert.rejects(share.refreshRunwayJob('owner', input.id))
  assert.equal((await store.runwayJob('owner', input.id)).status, 'submitted')
  assert.equal(calls.filter(call => String(call.url).startsWith('http://127.0.0.1')).length, 0)
  hostile = false
  const ready = await share.refreshRunwayJob('owner', input.id)
  assert.equal(ready.status, 'ready')
  assert.ok(!JSON.stringify(ready).includes('cloudfront'))
  assert.deepEqual(Buffer.from(await store.readRunwayVideo(await store.runwayJob('owner', input.id))), mp4)
  const previousCalls = calls.length
  assert.equal((await share.refreshRunwayJob('owner', input.id)).status, 'ready')
  assert.equal(calls.length, previousCalls, 'Saved video never re-fetches or re-generates')
  const interrupted = request(sword)
  providerFailure = true
  await assert.rejects(share.createRunwayJob('owner', interrupted), error => error.status === 502 && !error.message.includes('fixture-private-key'))
  providerFailure = false
  assert.equal((await share.createRunwayJob('owner', interrupted)).status, 'unknown')
  assert.equal(calls.filter(call => call.url.endsWith('/image_to_video')).length, 2, 'Unknown submission is never retried')
  await assert.rejects(share.createRunwayJob('owner', request(map)), error => error.status === 429)
  process.env.MUSE_RUNWAY_BUDGET_CREDITS = '47'
  await assert.rejects(share.createRunwayJob('another-owner', request(map)), error => error.status === 429)
  process.env.MUSE_RUNWAY_BUDGET_CREDITS = '1000'
  const failed = await share.createRunwayJob('second-owner', request(sword))
  generationFailure = true
  assert.equal((await share.refreshRunwayJob('second-owner', failed.id)).status, 'failed')
  generationFailure = false
  assert.equal((await store.runwayJobs('owner')).length, 2)
  globalCapDenied = true
  const capped = request(map)
  const beforeCap = calls.length
  await assert.rejects(share.createRunwayJob('capped-owner', capped), error => error.status === 429)
  assert.equal(calls.length, beforeCap, 'Global AI cap denial never reaches the paid provider')
  assert.equal((await store.runwayJob('capped-owner', capped.id)).status, 'failed', 'Definitive pre-provider denial is not ambiguous')
  globalCapDenied = false
  assert.equal((await share.createRunwayJob('capped-owner', capped)).status, 'failed', 'Reserved attempt is never resubmitted')
  assert.equal(calls.length, beforeCap)
  for (const url of ['https://evil.example/video.mp4', 'https://dnznrvs05pmza.cloudfront.net.evil.example/a', 'http://dnznrvs05pmza.cloudfront.net/a',
    'https://user:pass@dnznrvs05pmza.cloudfront.net/a', 'https://dnznrvs05pmza.cloudfront.net:8443/a']) {
    assert.throws(() => share.runwayOutputUrl(url))
  }
  const sql = fs.readFileSync(path.join(root, 'supabase', 'runway-sharing.sql'), 'utf8')
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /check \(credits = 16\)/)
  assert.match(sql, /p_credits <> 16/)
  assert.match(sql, /drop constraint if exists muse_runway_jobs_credits_check/)
  assert.match(sql, /enable row level security/)
  assert.match(sql, /revoke all on function .* from public, anon, authenticated/)
  assert.match(sql, /'muse-runway-clips', 'muse-runway-clips', false/)

  let account = { id: 'owner', permissions: { managed: true, services: true } }, safe = true
  const api = load('src/pages/api/runway-share.ts', {
    ...mocks,
    '../../lib/accountAuth': { requireAccount: async (_req, res) => { if (!account) res.status(401).json({ error: 'Sign in' }); return account } },
    '../../lib/providerConsent': { requireAccountProviderConsent(permissions) { if (!permissions?.services) throw new SharedStoryError('Permission required', 403) } },
    '../../lib/operations': { apiSafety: async () => safe, reportOperation: async () => true }
  }).default
  const run = async (body, method = 'POST') => {
    const result = { statusCode: 200, headers: {} }
    await api({ method, body }, {
      setHeader(key, value) { result.headers[key] = value },
      status(code) { result.statusCode = code; return this },
      json(value) { result.body = value; return this }, send(value) { result.body = value; return this }
    })
    return result
  }
  assert.equal((await run({ action: 'quote' }, 'GET')).statusCode, 405)
  account = null
  assert.equal((await run({ action: 'quote' })).statusCode, 401)
  account = { id: 'owner', permissions: { managed: true, services: false } }
  assert.equal((await run({ action: 'create', ...request(map) })).statusCode, 403)
  assert.equal((await run({ action: 'video', id: input.id })).headers['Content-Type'], 'video/mp4')
  account = { id: 'another-owner', permissions: { managed: true, services: true } }
  assert.equal((await run({ action: 'video', id: input.id })).statusCode, 404)
  account = { id: 'owner', permissions: { managed: true, services: true } }
  assert.equal((await run({ action: 'video', id: interrupted.id })).statusCode, 409)
  const list = await run({ action: 'list' })
  assert.equal(list.body.jobs.length, 2)
  assert.ok(!JSON.stringify(list).includes('owner_id'))
  safe = false
  const count = calls.length
  await run({ action: 'create', ...request(map) })
  assert.equal(calls.length, count)
  console.log('PASS Runway consent, exact cost, brief privacy, atomic duplicate protection, quota accounting, unknown/failed jobs, private MP4 persistence, task/output validation, authentication and owner isolation')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  global.fetch = oldFetch
  for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key]
  Object.assign(process.env, environment)
  fs.rmSync(temporary, { recursive: true, force: true })
})

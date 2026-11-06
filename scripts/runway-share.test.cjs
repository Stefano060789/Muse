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
  let providerCalls = 0
  global.fetch = async () => { providerCalls++; throw new Error('Runway provider must remain blocked') }
  const mocks = {
    './sharedStory': { SharedStoryError },
    './storyRepository': { storyStorageMode: () => process.env.STORY_STORAGE },
    './operations': { reserveAiAttempt: async () => { throw new Error('No paid attempt may be reserved') } },
    '../../lib/sharedStory': { SharedStoryError }
  }
  const share = load('src/lib/runwayShare.ts', mocks)
  const store = load('src/lib/runwayShareStore.ts', mocks)
  const brief = load('src/lib/runwayShareBrief.ts', mocks)
  const frame = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 1, 2, 0xff, 0xd9]).toString('base64')}`
  const id = crypto.randomUUID()
  const validRequest = {
    id, brief: 'A parchment map moving gently in a warm breeze, illustrated storybook style.',
    frame, approved: true, approvedCredits: 16, consentVersion: brief.RUNWAY_SHARE_CONSENT
  }
  assert.ok(brief.validRunwayFrame(frame))
  assert.equal(share.runwayConfiguration().available, false, 'Environment flags and credentials cannot enable Runway')
  assert.equal(share.runwayQuote().available, false)
  assert.equal(share.runwayQuote().disabledReason, 'commercial-entitlement-required')
  await assert.rejects(share.createRunwayJob('owner', validRequest), error =>
    error instanceof SharedStoryError && error.status === 503 && /disabled pending commercial entitlement review/.test(error.message))
  assert.equal(providerCalls, 0)

  const saved = {
    id: crypto.randomUUID(), owner_id: 'owner', fingerprint: 'f'.repeat(64), credits: 16,
    created_at: new Date().toISOString(), status: 'ready', task_id: crypto.randomUUID()
  }
  const submitted = {
    ...saved, id: crypto.randomUUID(), status: 'submitted', task_id: crypto.randomUUID()
  }
  await store.runwayStoreReady()
  await store.reserveRunwayJob(saved, 1000, 2)
  await store.writeRunwayVideo(saved, Buffer.from([0, 0, 0, 16, ...Buffer.from('ftypisom'), 1, 2, 3, 4]))
  await store.reserveRunwayJob(submitted, 1000, 2)
  assert.deepEqual(Buffer.from(await store.readRunwayVideo(saved)),
    Buffer.from([0, 0, 0, 16, ...Buffer.from('ftypisom'), 1, 2, 3, 4]))
  assert.equal((await share.refreshRunwayJob('owner', saved.id)).status, 'ready', 'Completed saved jobs remain readable without provider access')
  await assert.rejects(share.refreshRunwayJob('owner', submitted.id), error =>
    error instanceof SharedStoryError && error.status === 503 && /disabled pending commercial entitlement review/.test(error.message))
  assert.equal((await store.runwayJobs('owner')).length, 2, 'Disabling the integration leaves saved job records intact')
  assert.equal(providerCalls, 0)

  let account = { id: 'owner', permissions: { managed: true, services: true } }
  const api = load('src/pages/api/runway-share.ts', {
    ...mocks,
    '../../lib/accountAuth': { requireAccount: async (_req, res) => {
      if (!account) res.status(401).json({ error: 'Sign in' })
      return account
    } },
    '../../lib/providerConsent': { requireAccountProviderConsent() {} },
    '../../lib/operations': { apiSafety: async () => true, reportOperation: async () => true }
  }).default
  const run = async body => {
    const result = { statusCode: 200, headers: {} }
    await api({ method: 'POST', body }, {
      setHeader(key, value) { result.headers[key] = value },
      status(code) { result.statusCode = code; return this },
      json(value) { result.body = value; return this },
      send(value) { result.body = value; return this }
    })
    return result
  }
  const quote = await run({ action: 'quote' })
  assert.equal(quote.statusCode, 503)
  assert.equal(quote.body.code, 'runway-commercial-entitlement-required')
  assert.match(quote.body.error, /disabled pending commercial entitlement review/)
  const create = await run({ action: 'create', ...validRequest })
  assert.equal(create.statusCode, 503)
  assert.match(create.body.error, /disabled pending commercial entitlement review/)
  const list = await run({ action: 'list' })
  assert.equal(list.statusCode, 200)
  assert.equal(list.body.jobs.length, 2)
  const video = await run({ action: 'video', id: saved.id })
  assert.equal(video.statusCode, 200)
  assert.equal(video.headers['Content-Type'], 'video/mp4')
  assert.equal(providerCalls, 0, 'No quote, create, or status path calls Runway')
  console.log('PASS Runway stays server-blocked with enabling env/credentials while existing saved jobs and clips remain intact')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  global.fetch = oldFetch
  for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key]
  Object.assign(process.env, environment)
  fs.rmSync(temporary, { recursive: true, force: true })
})

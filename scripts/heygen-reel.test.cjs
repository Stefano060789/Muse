const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const saved = { ...process.env }
const oldFetch = global.fetch
class SharedStoryError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}
function load(file, mocks) {
  const module = { exports: {} }
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  new Function('module', 'exports', 'require', code)(module, module.exports, id => id in mocks ? mocks[id] : require(id))
  return module.exports
}
async function main() {
  const counts = new Map()
  const consumeOperation = async (bucket, limit) => {
    const used = counts.get(bucket) || 0
    if (used >= limit) return { allowed: false, used, notify: false }
    counts.set(bucket, used + 1)
    return { allowed: true, used: used + 1, notify: false }
  }
  const reel = load('src/lib/heygenReel.ts', { './operationsStore': { consumeOperation }, './sharedStory': { SharedStoryError } })
  const chapterId = crypto.randomUUID(), capability = 'a'.repeat(64)
  let accountId = 'owner-a', providerCreates = 0
  let chapter = { snapshot: { status: 'active', pending: false }, record: { turn: { concluded: false } } }
  const handler = load('src/pages/api/heygen-reel.ts', {
    '../../lib/accountAuth': { requireAccount: async () => ({ id: accountId }) },
    '../../lib/providerConsent': { requireAccountProviderConsent() {} },
    '../../lib/operations': { apiSafety: async () => true, reportOperation: async () => {} },
    '../../lib/sharedStory': { SharedStoryError },
    '../../lib/heygenReel': {
      heygenConfigured: () => true,
      createHeygenReel: async () => { providerCreates++; return { token: 'existing', status: 'pending' } },
      heygenReelStatus: async () => ({ status: 'completed' }), downloadHeygenReel: async () => Buffer.from('video')
    },
    '../../lib/storyRequestLimits': { storyDatabase: () => ({ personalJourney: async request => {
      if (request.accountId !== 'owner-a' || request.id !== chapterId) throw new SharedStoryError('Journey: session unavailable', 404)
      assert.equal(request.operation, 'view')
      assert.equal(request.capabilityHash, crypto.createHash('sha256').update(capability).digest('hex'))
      return chapter
    } }) },
    '../../lib/sharedAdventure': { adventureGlobalCap: () => 100 },
    '../../lib/personalJourney': {
      journeyIdentifier: value => {
        if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) throw new SharedStoryError('Invalid chapter.')
        return value
      },
      journeyCapability: value => {
        if (typeof value !== 'string' || !/^[0-9a-f]{64}$/i.test(value)) throw new SharedStoryError('Invalid capability.')
        return value
      },
      journeyHash: value => crypto.createHash('sha256').update(value).digest('hex')
    }
  }).default
  async function endpoint(body) {
    const res = {
      statusCode: 200, body: null, setHeader() {},
      status(code) { this.statusCode = code; return this },
      json(value) { this.body = value; return this },
      send(value) { this.body = value; return this }
    }
    await handler({ method: 'POST', body }, res)
    return res
  }
  const videoRequest = { action: 'create', storyId: chapterId, storyCapability: capability }
  assert.equal((await endpoint({ action: 'create' })).statusCode, 400)
  for (const [status, pending, concluded] of [
    ['active', false, false], ['exhausted', false, false],
    ['concluded', true, true], ['concluded', false, false]
  ]) {
    chapter = { snapshot: { status, pending }, record: { turn: { concluded } } }
    assert.equal((await endpoint(videoRequest)).statusCode, 409)
  }
  chapter = { snapshot: { status: 'concluded', pending: false }, record: { turn: { concluded: true } } }
  accountId = 'owner-b'
  assert.equal((await endpoint(videoRequest)).statusCode, 404, 'Another account cannot use the completed chapter')
  assert.equal(providerCreates, 0, 'Unfinished and unauthorized chapters never invoke paid generation')
  accountId = 'owner-a'
  assert.equal((await endpoint(videoRequest)).statusCode, 200)
  assert.equal(providerCreates, 1)
  assert.equal((await endpoint({ action: 'status', token: 'existing' })).statusCode, 200, 'Existing videos remain accessible')
  process.env.HEYGEN_API_KEY = 'synthetic-key'
  delete process.env.HEYGEN_REEL_PROVIDER_APPROVED
  const input = {
    id: crypto.randomUUID(), created: Date.now(), prompt: 'A lantern glows beside a quiet forest path.',
    approved: true, consentVersion: reel.HEYGEN_REEL_CONSENT
  }
  const calls = []
  let videoUrl = 'https://resource2.heygen.ai/example.mp4'
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    if (String(url) === 'https://api.heygen.com/v3/models/videos' && init.method === 'POST') {
      return Response.json({ data: { video_id: 'synthetic_video_1', status: 'pending' } }, { status: 202 })
    }
    if (String(url).startsWith('https://api.heygen.com/v3/models/videos/')) {
      return Response.json({ data: { status: 'completed', video_url: videoUrl } })
    }
    if (String(url) === videoUrl) return new Response(Buffer.from([0, 0, 0, 16, ...Buffer.from('ftypisom'), 1, 2, 3, 4]), { headers: { 'Content-Type': 'video/mp4' } })
    throw new Error('Unexpected request')
  }
  assert.equal(reel.heygenConfigured(), false)
  await assert.rejects(reel.createHeygenReel('owner-a', input), /disabled until/)
  assert.equal(calls.length, 0)
  process.env.HEYGEN_REEL_PROVIDER_APPROVED = 'true'
  assert.equal(reel.heygenConfigured(), true)
  await assert.rejects(reel.createHeygenReel('owner-a', { ...input, approved: false }), /approve/)
  await assert.rejects(reel.createHeygenReel('owner-a', { ...input, prompt: 'x'.repeat(4001) }), /approve/)
  assert.equal(calls.length, 0)
  const created = await reel.createHeygenReel('owner-a', input)
  assert.equal(created.status, 'pending')
  assert.equal(calls.length, 1)
  const sent = JSON.parse(calls[0].init.body)
  assert.equal(sent.duration, 10)
  assert.equal(sent.resolution, '768p')
  assert.equal(sent.aspect_ratio, '9:16')
  assert.equal(sent.mode, 'text_to_video')
  assert.equal(calls[0].init.headers['X-Api-Key'], 'synthetic-key')
  assert.ok(calls[0].init.headers['Idempotency-Key'])
  await assert.rejects(reel.createHeygenReel('owner-a', input), /already submitted/)
  assert.equal(calls.length, 1, 'Duplicate clicks do not submit twice')
  await assert.rejects(reel.heygenReelStatus('owner-b', created.token), /does not belong/)
  await assert.rejects(reel.heygenReelStatus('owner-a', created.token + 'x'), /Invalid/)
  assert.equal(calls.length, 1, 'Another account cannot poll this reel')
  assert.equal((await reel.heygenReelStatus('owner-a', created.token)).status, 'completed')
  assert.equal((await reel.downloadHeygenReel('owner-a', created.token)).toString('ascii', 4, 8), 'ftyp')
  videoUrl = 'https://attacker.example/file.mp4'
  const before = calls.length
  await assert.rejects(reel.downloadHeygenReel('owner-a', created.token), /unexpected video host/)
  assert.equal(calls.length, before + 1, 'The untrusted output URL is never fetched')
  const parallelInput = { ...input, id: crypto.randomUUID() }
  const parallel = await Promise.allSettled([
    reel.createHeygenReel('owner-b', parallelInput),
    reel.createHeygenReel('owner-b', parallelInput)
  ])
  assert.equal(parallel.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(parallel.filter(result => result.status === 'rejected').length, 1, 'Concurrent duplicates cannot create two jobs')
  const afterParallel = calls.length
  counts.set('heygen-reel-pilot-v1', 27)
  await assert.rejects(reel.createHeygenReel('owner-a', { ...input, id: crypto.randomUUID() }), /pilot reservation limit/)
  assert.equal(calls.length, afterParallel, 'Budget exhaustion prevents provider calls')
  counts.set('heygen-reel-pilot-v1', 2)
  global.fetch = async () => { throw new Error('simulated connection failure') }
  const uncertain = { ...input, id: crypto.randomUUID() }
  await assert.rejects(reel.createHeygenReel('owner-c', uncertain), /did not confirm/)
  assert.equal(counts.get('heygen-reel-pilot-v1'), 3, 'Unconfirmed submissions remain counted')
  await assert.rejects(reel.createHeygenReel('owner-c', uncertain), /already submitted/)
  console.log('PASS HeyGen consent, fixed video format, duplicate charge prevention, ownership, output safety and pilot limit')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  global.fetch = oldFetch
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
  Object.assign(process.env, saved)
})

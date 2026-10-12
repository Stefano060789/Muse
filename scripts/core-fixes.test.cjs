const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.core-tests-'))
const saved = { window: global.window, fetch: global.fetch, env: { ...process.env } }
let passed = 0
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`) }

async function main() {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/profile.ts', 'src/lib/personalStoryGenerator.ts',
    '--outDir', output, '--module', 'commonjs', '--target', 'es2020',
    '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })
  const files = fs.readdirSync(output)
  const base = files.includes('profile.js') ? output : path.join(output, 'lib')
  const profile = require(path.join(base, 'profile.js'))
  const storage = new Map()
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
  }
  global.window = { localStorage }
  await check('profile save, edit, remove and forget preserve bounded memories', () => {
    const first = profile.saveMuseProfile('I love stars. I enjoy walks.')
    assert.equal(first.keypoints.length, 2)
    const appended = profile.saveMuseProfile('I love stars. Music helps.')
    assert.deepEqual(appended.keypoints, ['I love stars', 'I enjoy walks', 'Music helps'])
    const edited = profile.replaceMuseProfileKeypoints(['I love planets', 'Music helps'])
    assert.deepEqual(profile.loadMuseProfile(), edited)
    const removed = profile.replaceMuseProfileKeypoints(['Music helps'])
    assert.deepEqual(removed.keypoints, ['Music helps'])
    profile.forgetMuseProfile()
    assert.equal(profile.loadMuseProfile(), null)
    assert.throws(() => profile.replaceMuseProfileKeypoints(['']))
    assert.throws(() => profile.replaceMuseProfileKeypoints(['x'.repeat(181)]))
    profile.replaceMuseProfileKeypoints(Array.from({ length: 20 }, (_, i) => `Memory ${i}`))
    const raw = storage.get('muse-profile')
    assert.throws(() => profile.saveMuseProfile('Another memory.'), /20 memories/)
    assert.equal(storage.get('muse-profile'), raw)
  })
  await check('blocked storage produces explicit errors without changing saved memories', () => {
    const raw = storage.get('muse-profile')
    const set = localStorage.setItem, get = localStorage.getItem, remove = localStorage.removeItem
    localStorage.setItem = () => { throw new Error('Quota exceeded') }
    assert.throws(() => profile.replaceMuseProfileKeypoints(['New memory']), /could not be saved/)
    assert.equal(storage.get('muse-profile'), raw)
    localStorage.getItem = () => { throw new Error('Denied') }
    assert.throws(() => profile.loadMuseProfile(), /cannot read/)
    localStorage.getItem = get
    localStorage.removeItem = () => { throw new Error('Denied') }
    assert.throws(() => profile.forgetMuseProfile(), /could not be removed/)
    localStorage.setItem = set
    localStorage.removeItem = remove
  })
  await check('corrupt and invalid profiles are reported without erasing stored data', () => {
    for (const raw of ['broken JSON', '{}', '{"about":"x","keypoints":[42],"updatedAt":"invalid"}']) {
      storage.set('muse-profile', raw)
      assert.throws(() => profile.loadMuseProfile(), /damaged|invalid/)
      assert.throws(() => profile.saveMuseProfile('A new memory.'), /damaged|invalid/)
      assert.equal(storage.get('muse-profile'), raw)
    }
    profile.forgetMuseProfile()
  })
  const { generatePersonalStory, parsePersonalStoryRequest } = require(path.join(base, 'personalStoryGenerator.js'))
  process.env.LLM_PROVIDER = 'ANTHROPIC'
  process.env.ANTHROPIC_API_KEY = 'fake-core-test-key'
  const scene = { title: 'The sky', body: 'You follow a quiet path.', question: 'Where next?', choices: ['Garden', 'Bridge', 'Hill'] }
  let calls = 0
  global.fetch = async (_url, options) => {
    calls++
    const request = JSON.parse(options.body)
    const example = request.system.match(/top-level JSON shape with every required field: (\{.*\})\./)?.[1]
    assert.ok(example, 'Required complete output schema must appear in the prompt')
    const shape = JSON.parse(example.replace('[...]', '[]'))
    assert.equal(shape.narrationStyle, 'calm')
    assert.equal(shape.narrationLanguage, 'en-US')
    const result = shape.scene ? { ...shape, scene } : { ...shape, title: 'The sky walk', description: 'A peaceful story', scenes: [scene, scene, scene] }
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(result) }], stop_reason: 'end_turn' }))
  }
  await check('AI creation and both continuations specify all required top-level narration fields', async () => {
    const created = await generatePersonalStory(parsePersonalStoryRequest({ action: 'create', mood: 'relaxed', need: '', profileKeypoints: [] }))
    const second = await generatePersonalStory(parsePersonalStoryRequest({ action: 'continue', story: created, answer: 'Bridge' }))
    const third = await generatePersonalStory(parsePersonalStoryRequest({ action: 'continue', story: second, answer: 'Hill' }))
    assert.equal(third.currentStep, 2)
    assert.deepEqual(third.responses, ['Bridge', 'Hill'])
    assert.equal(third.narrationStyle, 'calm')
    assert.equal(calls, 3)
  })
  console.log(`\n${passed} core fix checks passed.`)
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  global.window = saved.window
  global.fetch = saved.fetch
  for (const key of Object.keys(process.env)) if (!(key in saved.env)) delete process.env[key]
  Object.assign(process.env, saved.env)
  fs.rmSync(output, { recursive: true, force: true })
})

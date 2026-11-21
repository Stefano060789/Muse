const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-story-reel-'))
const originalEnv = { ...process.env }
const originalFetch = global.fetch
let checks = 0

async function check(name, run) {
  await run()
  checks++
  console.log(`PASS ${name}`)
}

async function main() {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/storyReelLogic.ts', 'src/lib/storyReel.ts', 'src/lib/storyReelImageProvider.ts',
    'src/lib/storyReelLimits.ts', 'src/lib/storyReelPremium.ts', 'src/lib/storyReelCopy.ts',
    '--outDir', output, '--strict', '--module', 'commonjs', '--target', 'es2020',
    '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })

  const moduleOutput = fs.existsSync(path.join(output, 'storyReel.js')) ? output : path.join(output, 'lib')
  const logic = require(path.join(moduleOutput, 'storyReelLogic.js'))
  const reel = require(path.join(moduleOutput, 'storyReel.js'))
  const provider = require(path.join(moduleOutput, 'storyReelImageProvider.js'))
  const premium = require(path.join(moduleOutput, 'storyReelPremium.js'))
  const copy = require(path.join(moduleOutput, 'storyReelCopy.js'))

  await check('caption and prompt sanitising remove risky or overlong content', () => {
    assert.equal(logic.truncateStoryReelCaption('x'.repeat(120), 20).length <= 20, true)
    const safe = logic.sanitizeStoryReelPrompt('https://private.example with answer details', 'fallback prompt')
    assert.equal(safe, 'fallback prompt')
    assert.equal(logic.sanitizeStoryReelSummary('Your choice to reveal a private answer gives this moment its direction.').length < 20, true)
  })

  await check('fallback and timeline logic stay within short-reel bounds', () => {
    const source = {
      title: 'The Garden',
      mood: 'hopeful',
      language: 'en-US',
      scenes: Array.from({ length: 6 }, (_, index) => ({ index, title: `Scene ${index + 1}`, summary: `Moment ${index + 1}` }))
    }
    const fallback = logic.fallbackStoryReelMoments(source)
    assert.equal(fallback.length, 6)
    assert.equal(new Set(fallback.map(moment => moment.scene)).size, 6)
    const timeline = logic.storyReelTimeline(fallback.length)
    assert.ok(timeline.totalSeconds >= 15 && timeline.totalSeconds <= 30)
    assert.ok(timeline.crossfadeSeconds > 0)
  })

  await check('story-reel planning excludes answers and accepts strict AI JSON', async () => {
    process.env.STORY_STORAGE = 'sqlite'
    process.env.MUSE_OPERATIONS_SQLITE_PATH = path.join(output, 'operations.sqlite')
    process.env.MUSE_AI_DAILY_ATTEMPT_CAP = '100'
    process.env.MUSE_STORY_REEL_PLAN_USER_DAILY_CAP = '20'
    process.env.LLM_PROVIDER = 'GROQ'
    process.env.LLM_API_KEY = 'fixture-key'

    let requestBody
    global.fetch = async (_url, options) => {
      requestBody = JSON.parse(options.body)
      return new Response(JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ moments: [
          { scene: 1, caption: 'A quiet beginning opens the gate.', prompt: 'Warm dawn light over an old garden gate, cinematic, vertical 9:16, no text.' },
          { scene: 2, caption: 'A lantern reveals the hidden path.', prompt: 'Lantern glow along winding stone path, atmospheric storybook painting, vertical 9:16.' },
          { scene: 3, caption: 'The promise becomes clear.', prompt: 'A calm figure in moonlit courtyard, hopeful expression, cinematic framing, 9:16.' },
          { scene: 4, caption: 'A gentle ending invites sharing.', prompt: 'Soft sunrise over garden archway, painterly scene, vertical poster composition.' }
        ] }) } }]
      }), { status: 200 })
    }

    const input = reel.parseStoryReelPlanInput({
      title: 'The Garden', mood: 'hopeful', language: 'en-US', currentStep: 3,
      scenes: [
        { title: 'One', body: 'Your choice to answer with private text gives this moment its direction.' },
        { title: 'Two', body: 'The lantern moved ahead.' },
        { title: 'Three', body: 'A doorway appeared.' },
        { title: 'Four', body: 'The ending felt warm.' }
      ]
    })
    const plan = await reel.generateStoryReelPlan(input, 'account-a')
    assert.equal(plan.source, 'ai')
    assert.equal(plan.moments.length, 4)
    assert.ok(plan.moments.every(moment => moment.caption && moment.prompt))
    const payload = JSON.parse(requestBody.messages[1].content)
    assert.ok(!JSON.stringify(payload).includes('private text'))
    assert.ok(!JSON.stringify(payload).includes('answer'))
  })

  await check('image provider stays disabled by default and uses mock only when explicitly enabled', async () => {
    delete process.env.MUSE_STORY_REEL_IMAGE_PROVIDER_ENABLED
    delete process.env.MUSE_STORY_REEL_IMAGE_PROVIDER
    assert.equal(provider.storyReelImageProviderStatus().enabled, false)

    process.env.MUSE_STORY_REEL_IMAGE_PROVIDER_ENABLED = 'true'
    process.env.MUSE_STORY_REEL_IMAGE_PROVIDER = 'mock'
    process.env.MUSE_STORY_REEL_IMAGE_USER_DAILY_CAP = '10'
    const images = await provider.generateStoryReelProviderImages('account-a', {
      title: 'The Garden', mood: 'hopeful', language: 'en-US',
      scenes: [{ index: 0, title: 'One', summary: 'A gate opens.' }]
    }, [{ id: 'moment-1', scene: 0, caption: 'A gate opens.', prompt: 'A gate opens at dawn.', motif: 'light' }], 'starlight')
    assert.equal(images.length, 1)
    assert.match(images[0].dataUrl, /^data:image\/svg\+xml/)
  })

  await check('premium gate denies by default and copy has language fallback', () => {
    const status = premium.storyReelPremiumStatus()
    assert.equal(status.available, false)
    assert.equal(status.reason, 'commercial-entitlement-required')
    for (const language of ['en-US', 'it-IT', 'es-ES', 'zh-CN', 'hi-IN', 'uk-UA', 'ar-SA']) {
      const labels = copy.storyReelCopy(language)
      assert.ok(Object.values(labels).every(value => typeof value === 'string' && value.trim()))
    }
  })

  console.log(`Passed ${checks} story reel checks.`)
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    global.fetch = originalFetch
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key]
    }
    Object.assign(process.env, originalEnv)
    fs.rmSync(output, { recursive: true, force: true })
  })

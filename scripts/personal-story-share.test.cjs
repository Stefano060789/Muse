const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-personal-share-'))
const originalEnv = { ...process.env }
const originalFetch = global.fetch
let passed = 0

async function check(name, run) {
  await run()
  passed++
  console.log(`PASS ${name}`)
}

async function main() {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/personalStoryShare.ts', 'src/lib/personalStoryShareCopy.ts', 'src/lib/personalStoryShareVisual.ts',
    '--outDir', output, '--strict', '--module', 'commonjs', '--target', 'es2020',
    '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })

  const moduleOutput = fs.existsSync(path.join(output, 'personalStoryShare.js'))
    ? output : path.join(output, 'lib')
  const share = require(path.join(moduleOutput, 'personalStoryShare.js'))
  const copy = require(path.join(moduleOutput, 'personalStoryShareCopy.js'))
  const visual = require(path.join(moduleOutput, 'personalStoryShareVisual.js'))
  const locales = ['en-US', 'zh-CN', 'hi-IN', 'es-ES', 'it-IT', 'uk-UA', 'ar-SA']

  await check('share teaser input is limited to a valid title, mood, and supported language', () => {
    assert.deepEqual(share.parsePersonalStoryShareInput({
      title: '  A New Beginning  ', mood: 'hopeful', language: 'it-IT',
      scenes: ['private scene'], ending: 'private ending'
    }), { title: 'A New Beginning', mood: 'hopeful', language: 'it-IT' })
    for (const input of [
      { title: '', mood: 'hopeful', language: 'en-US' },
      { title: 'x'.repeat(161), mood: 'hopeful', language: 'en-US' },
      { title: 'Title', mood: 'unknown', language: 'en-US' },
      { title: 'Title', mood: 'hopeful', language: 'fr-FR' },
      null
    ]) assert.throws(() => share.parsePersonalStoryShareInput(input))
  })

  await check('all interface languages provide share consent and action labels', () => {
    for (const language of locales) {
      for (const key of [
        'shareStoryTitle', 'shareStoryDescription', 'teaserConsent', 'createTeaser',
        'creatingTeaser', 'teaserLabel', 'shareOnSocial', 'copySummary',
        'downloadCard', 'shareReady', 'copiedShare', 'shareError', 'shareCardTagline', 'shareTextFooter'
      ]) assert.ok(copy.personalStoryShareText(key, language).trim(), `${language}: ${key}`)
      for (const mood of ['adventure', 'relaxed', 'curious', 'hopeful']) {
        assert.ok(copy.personalStoryMoodText(mood, language).trim(), `${language}: ${mood}`)
      }
    }
  })

  await check('share card escapes supplied text and preserves a spoiler-free share message', () => {
    const svg = visual.createPersonalStoryShareSvg({
      title: '<script>alert("no")</script>',
      teaser: 'A curious beginning & a gentle path toward something new.',
      mood: 'Curious & hopeful',
      brand: 'Muse',
      tagline: 'A story shaped around you.',
      url: 'https://muse.example/?a=1&b=2'
    })
    assert.doesNotMatch(svg, /<script>/)
    assert.match(svg, /&lt;script&gt;/)
    assert.match(svg, /A curious beginning &amp; a gentle path/)
    assert.match(svg, /A story shaped around you\./)
    assert.match(svg, /https:\/\/muse\.example\/\?a=1&amp;b=2/)
    const cjkSvg = visual.createPersonalStoryShareSvg({
      title: '星'.repeat(100), teaser: '故事从一个温柔的邀请开始。', mood: '希望',
      brand: 'Muse', tagline: '为你量身打造的故事。', url: 'https://muse.example'
    })
    const titleText = [...cjkSvg.matchAll(/<tspan x="96" dy="[^"]*">([^<]*)<\/tspan>/g)]
      .slice(0, 3).map(match => match[1]).join('')
    assert.ok(Array.from(titleText).length <= 79, 'Long unspaced titles are wrapped and truncated')
    assert.ok(titleText.endsWith('…'))
    const message = visual.personalStoryShareText('My story', 'A gentle beginning.', 'Hopeful', 'Made with Muse. Create your own story at', 'https://muse.example')
    assert.match(message, /My story/)
    assert.match(message, /Create your own story at https:\/\/muse\.example/)
  })

  await check('AI teaser request sends only title, broad mood, and requested language', async () => {
    process.env.LLM_PROVIDER = 'GROQ'
    process.env.LLM_API_KEY = 'local-share-test-key'
    process.env.MUSE_OPERATIONS_SQLITE_PATH = path.join(output, 'operations.sqlite')
    const teaser = 'A quiet invitation makes room for curiosity, gentle courage, and a fresh beginning shaped entirely by your own imagination.'
    let request
    global.fetch = async (_url, options) => {
      request = JSON.parse(options.body)
      return new Response(JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ teaser }) } }]
      }), { status: 200 })
    }
    const input = { title: 'A New Beginning', mood: 'hopeful', language: 'it-IT' }
    assert.equal(await share.generatePersonalStoryShareTeaser(input), teaser)
    assert.deepEqual(JSON.parse(request.messages[1].content), input)
    assert.match(request.messages[0].content, /spoiler-free/)
    assert.match(request.messages[0].content, /Do not invent plot events/)
  })

  console.log(`Passed ${passed} personal story share checks.`)
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

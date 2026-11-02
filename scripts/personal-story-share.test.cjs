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
    'src/lib/personalStoryShare.ts', 'src/lib/personalStoryShareCopy.ts', 'src/lib/personalStoryShareVisual.ts', 'src/lib/shareStudioCopy.ts', 'src/lib/shareMotionCopy.ts',
    '--outDir', output, '--strict', '--module', 'commonjs', '--target', 'es2020',
    '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })

  const moduleOutput = fs.existsSync(path.join(output, 'personalStoryShare.js'))
    ? output : path.join(output, 'lib')
  const share = require(path.join(moduleOutput, 'personalStoryShare.js'))
  const copy = require(path.join(moduleOutput, 'personalStoryShareCopy.js'))
  const visual = require(path.join(moduleOutput, 'personalStoryShareVisual.js'))
  const { shareStudioCopy } = require(path.join(moduleOutput, 'shareStudioCopy.js'))
  const { shareMotionCopy } = require(path.join(moduleOutput, 'shareMotionCopy.js'))
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

  await check('moment cards support every size, theme and locale with escaped private selections and no external content', () => {
    for (const language of locales) {
      const studio = shareStudioCopy(language)
      assert.ok(Object.values(studio).every(value => value.trim()))
      assert.ok(Object.values(shareMotionCopy(language)).every(value => value.trim()))
      for (const format of ['portrait', 'story', 'square']) {
        for (const theme of ['starlight', 'paper', 'dawn']) {
          const svg = visual.createStoryMomentSvg({
            title: '<script>unsafe</script>', passage: 'A & B chose a new path.', reflection: 'My <moment>',
            milestone: studio.complete, progress: studio.chapter.replace('{number}', '2'), format, theme, rtl: language === 'ar-SA'
          })

          assert.match(svg, new RegExp(`width="1080" height="${visual.SHARE_CARD_SIZES[format].height}"`))
          assert.doesNotMatch(svg, /<script>|<image|<foreignObject|<animate|href=/)
          assert.match(svg, /&lt;script&gt;/)
          assert.match(svg, /A &amp; B/)
          assert.match(svg, /My &lt;moment&gt;/)
          assert.match(svg, new RegExp(`direction="${language === 'ar-SA' ? 'rtl' : 'ltr'}"`))
          assert.match(svg, /text-anchor="start" direction=/, 'RTL start anchors to the right, not beyond the canvas')
        }
      }
    }
  })

  await check('long CJK passages and titles keep bounded lines above the reflection and progress', () => {
    const svg = visual.createStoryMomentSvg({
      title: '星'.repeat(160), passage: '海'.repeat(200), reflection: '光'.repeat(120),
      milestone: 'Milestone', progress: 'Chapter 1', theme: 'paper', format: 'square', rtl: false
    })
    const blocks = [...svg.matchAll(/<text[^>]+y="(\d+(?:\.\d+)?)"[^>]+font-size="(\d+)"[^>]*>(.*?)<\/text>/g)]
    const title = blocks.find(block => block[1] === '250')
    const passage = blocks.find(block => block[1] === '465')
    const reflection = blocks.find(block => block[1] === '800')
    assert.equal((title[3].match(/<tspan/g) || []).length, 3)
    assert.equal((passage[3].match(/<tspan/g) || []).length, 9)
    assert.equal((reflection[3].match(/<tspan/g) || []).length, 3)
    assert.match(title[3], /…/)
    assert.match(reflection[3], /…/)
    assert.ok(465 + 8 * 30 * 1.22 < 800 - 27)
    assert.ok(800 + 2 * 27 * 1.22 < 1080 - 157 - 24)
  })

  await check('automatic highlights use the latest nonempty visited scene without inventing personal reflections', () => {
    assert.deepEqual(visual.suggestStoryMoment([{ body: 'Old scene.' }, { body: 'A new beginning.' }, { body: '  ' }], 'hopeful'),
      { scene: '1', passage: 'A new beginning.', theme: 'dawn' })
    assert.deepEqual(visual.suggestStoryMoment([], 'relaxed'), { scene: '', passage: '', theme: 'paper' })
    const long = visual.suggestStoryMoment([{ body: 'This is a meaningful first sentence that stays intact and is long enough to remember. ' + 'extra '.repeat(60) }], 'adventure')
    assert.equal(long.passage, 'This is a meaningful first sentence that stays intact and is long enough to remember.')
    assert.ok(visual.suggestStoryMoment([{ body: '星'.repeat(250) }], 'curious').passage.length <= 200)
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

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const root = path.resolve(__dirname, '..')
const languages = ['en-US', 'it-IT', 'es-ES', 'zh-CN', 'hi-IN', 'uk-UA', 'ar-SA']
let renderLanguage = 'en-US'

function load(relative) {
  const module = { exports: {} }
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true
    }
  }).outputText
  const localRequire = id => {
    if (id === 'next/head') return { __esModule: true, default: ({ children }) => React.createElement(React.Fragment, null, children) }
    if (id === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) }
    if (id === 'next/dynamic') return {
      __esModule: true,
      default: () => props => React.createElement(load('src/components/BrowserSampleNarration.tsx').default, props)
    }
    if (id.endsWith('/interfaceLanguage')) return { useInterfaceLanguage: () => renderLanguage }
    if (id.endsWith('/useNarration')) return {
      useNarration: () => ({
        busy: false, supported: true, error: '', loading: false, paused: false, speaking: false,
        canPause: false, speak() {}, pause() {}, resume() {}, stop() {}
      })
    }
    if (id.startsWith('.')) {
      const target = path.resolve(root, path.dirname(relative), id)
      if (target.endsWith('.json')) return JSON.parse(fs.readFileSync(target, 'utf8'))
      const file = ['.tsx', '.ts'].map(extension => target + extension).find(candidate => fs.existsSync(candidate))
      if (!file) throw new Error(`Could not resolve ${id} from ${relative}`)
      return load(path.relative(root, file))
    }
    return require(id)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const { demoLocalization } = load('src/lib/demoPageLocalization.ts')
const { SAMPLE_STORY, sampleAnswerMatches, sampleStoryForLanguage } = load('src/lib/sampleStory.ts')
const DemoPage = load('src/pages/demo.tsx').default

function renderPage(language, state) {
  renderLanguage = language
  let stateIndex = 0
  const originalUseState = React.useState
  React.useState = initial => [state[stateIndex++], () => {}]
  let tree
  try { tree = DemoPage() } finally { React.useState = originalUseState }
  assert.equal(stateIndex, 6, 'The demo uses the expected six local state values')
  return renderToStaticMarkup(tree)
}

function containsText(markup, text) {
  const escaped = renderToStaticMarkup(React.createElement('span', null, text)).slice(6, -7)
  return markup.includes(escaped)
}

for (const language of languages) {
  const { story, copy } = demoLocalization(language)
  const localizedStory = sampleStoryForLanguage(language)
  assert.deepEqual(localizedStory, story)
  assert.equal(story.scenes.length, 2)
  assert.ok(story.title && story.dedication && story.answer && story.message)
  assert.ok(story.scenes.every(scene => scene.title && scene.body && scene.clue))
  assert.ok(Object.entries(copy).filter(([key]) => key !== 'sceneCount').every(([, value]) => typeof value === 'string' && value.length > 0))
  assert.ok(copy.sceneCount(1, 2).length > 0)
  assert.equal(sampleAnswerMatches(story.answer, language), true, `${language} accepts its localized answer`)
  assert.equal(sampleAnswerMatches('picnic', language), true, `${language} accepts the English answer`)

  const introMarkup = renderPage(language, [false, 0, '', false, false, ''])
  assert.ok(containsText(introMarkup, story.title))
  assert.ok(containsText(introMarkup, copy.openStory))

  const sceneMarkup = renderPage(language, [true, 0, '', false, false, ''])
  assert.ok(sceneMarkup.includes(`lang="${language}"`), `${language} is set on the page`)
  assert.ok(containsText(sceneMarkup, story.scenes[0].title))
  assert.ok(containsText(sceneMarkup, story.scenes[0].body))
  assert.ok(containsText(sceneMarkup, story.scenes[0].clue))
  assert.ok(containsText(sceneMarkup, copy.privacyNotice))
  if (language === 'ar-SA') assert.ok(sceneMarkup.includes('dir="rtl"'))
  if (language === 'en-US') {
    assert.ok(sceneMarkup.includes('/sample-audio/scene-1-'))
    assert.ok(sceneMarkup.includes('prerecorded Google WaveNet voice'))
  } else {
    assert.ok(!sceneMarkup.includes('<audio'))
    assert.ok(containsText(sceneMarkup, copy.narrationNotice))
  }

  const revealMarkup = renderPage(language, [true, 1, '', true, false, ''])
  assert.ok(containsText(revealMarkup, story.message), `${language} renders the translated reveal`)
  if (language === 'en-US') assert.ok(revealMarkup.includes('/sample-audio/message-'))
  else assert.ok(!revealMarkup.includes('<audio'), `${language} never plays the English recording`)
}

assert.equal(SAMPLE_STORY.title, demoLocalization('en-US').story.title)
assert.equal(sampleAnswerMatches('A PICNIC!'), true)
assert.equal(sampleAnswerMatches('野餐', 'zh-CN'), true)
assert.equal(sampleAnswerMatches('पिकनिक', 'hi-IN'), true)
assert.equal(sampleAnswerMatches('пікнік', 'uk-UA'), true)
assert.equal(sampleAnswerMatches('نزهة', 'ar-SA'), true)
console.log(`PASS localized Muse demo copy, two-scene stories, browser-only audio, reveals and answers (${languages.length} locales)`)

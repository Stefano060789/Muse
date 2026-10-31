const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')

function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
}

const helperModule = { exports: {} }
new Function('module', 'exports', compile('src/lib/storyLifeBridge.ts'))(helperModule, helperModule.exports)
const bridge = helperModule.exports

function story(overrides = {}) {
  return {
    id: 'personal-1',
    mood: 'curious',
    title: 'A story',
    description: 'A description',
    createdAt: '2026-01-01T00:00:00.000Z',
    currentStep: 0,
    responses: [],
    scenes: [{ title: 'Scene', body: 'Story text', question: 'What next?', choices: [] }],
    ...overrides
  }
}

function checkCompletionGate() {
  assert.equal(bridge.canShowStoryLifeBridge(null, false), false)
  assert.equal(bridge.canShowStoryLifeBridge(story(), false), false, 'an incomplete story is hidden')
  assert.equal(bridge.canShowStoryLifeBridge(story({ archived: true, responses: ['done'] }), false), false)
  assert.equal(bridge.canShowStoryLifeBridge(story({ responses: ['done'] }), true), false, 'archive reading is hidden')
  assert.equal(bridge.canShowStoryLifeBridge(story({ responses: ['done'] }), false), true, 'completed legacy story is eligible')
  assert.equal(bridge.canShowStoryLifeBridge(story({ generation: 'ai' }), false), true, 'completed AI legacy ending is eligible')
  assert.equal(bridge.canShowStoryLifeBridge(story({ generation: 'ai', currentStep: 0, scenes: [{}, {}] }), false), false)
  assert.equal(bridge.canShowStoryLifeBridge(story({ scenes: [] }), false), false)

  const journey = status => story({
    journey: { status, pending: false },
    responses: [],
    scenes: [{ title: 'Ending', body: 'Completed chapter', question: '', choices: [] }]
  })
  assert.equal(bridge.canShowStoryLifeBridge(journey('concluded'), false), true)
  assert.equal(bridge.canShowStoryLifeBridge(journey('concluded'), true), false)
  assert.equal(bridge.canShowStoryLifeBridge(story({ ...journey('concluded'), journey: { status: 'concluded', pending: true } }), false), false)
  for (const status of ['preparing', 'active', 'exhausted', 'failed']) {
    assert.equal(bridge.canShowStoryLifeBridge(journey(status), false), false, `${status} journey is hidden`)
  }
}

function checkTransitionsAndLocales() {
  const locales = ['en-US', 'it-IT', 'es-ES', 'zh-CN', 'hi-IN', 'uk-UA', 'ar-SA']
  const moods = ['adventure', 'relaxed', 'curious', 'hopeful']
  for (const locale of locales) {
    const copy = bridge.getStoryLifeBridgeCopy(locale)
    for (const key of ['title', 'description', 'tryIt', 'chooseAnother', 'notToday', 'intended', 'declined']) {
      assert.equal(typeof copy[key], 'string', `${locale} has ${key}`)
      assert.ok(copy[key].length > 0)
    }
    for (const mood of moods) {
      const suggestions = [0, 1, 2].map(index => bridge.getStoryLifeBridgeAction(mood, locale, index))
      assert.ok(suggestions.every(value => typeof value === 'string' && value.length > 0), `${locale}/${mood} is localized`)
      assert.equal(new Set(suggestions).size, suggestions.length, `${locale}/${mood} has distinct actions`)
    }
  }
  assert.equal(bridge.getStoryLifeBridgeCopy('unsupported').title, bridge.getStoryLifeBridgeCopy('en-US').title)
  assert.equal(bridge.getStoryLifeBridgeAction('curious', 'unsupported', 0), bridge.getStoryLifeBridgeAction('curious', 'en-US', 0))

  const initial = bridge.createStoryLifeBridgeState()
  assert.deepEqual(initial, { actionIndex: 0, response: 'offered' })
  assert.deepEqual(bridge.transitionStoryLifeBridge(initial, 'try'), { actionIndex: 0, response: 'intended' })
  assert.deepEqual(bridge.transitionStoryLifeBridge(initial, 'another'), { actionIndex: 1, response: 'offered' })
  assert.deepEqual(bridge.transitionStoryLifeBridge(initial, 'not-today'), { actionIndex: 0, response: 'declined' })
  assert.deepEqual(bridge.createStoryLifeBridgeState(), initial, 'a new component session starts clean')
}

function checkComponentAndIntegration() {
  const componentSource = fs.readFileSync(path.join(root, 'src/components/StoryLifeBridge.tsx'), 'utf8')
  const pageSource = fs.readFileSync(path.join(root, 'src/pages/story.tsx'), 'utf8')
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'setTimeout', 'Notification']) {
    assert.ok(!componentSource.includes(forbidden), `component must not use ${forbidden}`)
  }
  assert.match(pageSource, /key=\{`\$\{story\.id\}:\$\{story\.chapter\?\.number \?\? 1\}`\}/)
  assert.match(pageSource, /story=\{story\}[\s\S]*archiveReading=\{archiveReading\}[\s\S]*language=\{interfaceLanguage\}/)
  const slots = []
  let cursor = 0
  let requests = 0
  const jsx = (type, props) => ({ type, props: props || {} })
  const react = {
    useState(initialValue) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initialValue === 'function' ? initialValue() : initialValue
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
    }
  }
  const componentModule = { exports: {} }
  new Function('module', 'exports', 'require', 'fetch', compile('src/components/StoryLifeBridge.tsx'))(
    componentModule,
    componentModule.exports,
    id => id === 'react' ? react
      : id === 'react/jsx-runtime' ? { jsx, jsxs: jsx }
        : id === '../lib/storyLifeBridge' ? bridge
          : {},
    () => { requests++; throw new Error('The component must not make requests') }
  )
  const render = () => {
    cursor = 0
    return componentModule.exports.default({
      story: story({ generation: 'ai', currentStep: 0 }),
      archiveReading: false,
      language: 'en-US'
    })
  }
  const flatten = node => node == null || typeof node === 'boolean' ? []
    : Array.isArray(node) ? node.flatMap(flatten)
      : typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node]
  const text = node => flatten(node.props?.children).filter(value => typeof value === 'string').join('')
  let tree = render()
  const buttons = () => flatten(tree).filter(node => node.type === 'button')
  assert.deepEqual(buttons().map(text), ['Try it', 'Choose another', 'Not today'])
  assert.ok(flatten(tree).some(node => node.props?.children === 'Spend a few minutes exploring a question that interests you.'))

  buttons()[0].props.onClick()
  tree = render()
  assert.ok(flatten(tree).some(node => node.props?.role === 'status' && text(node).includes('You made room for this intention')))
  assert.deepEqual(buttons().map(text), ['Choose another', 'Not today'])
  buttons()[0].props.onClick()
  tree = render()
  assert.ok(flatten(tree).some(node => node.props?.children === 'Ask someone how they learned something you find interesting.'))
  buttons()[2].props.onClick()
  tree = render()
  assert.ok(flatten(tree).some(node => node.props?.role === 'status' && text(node).includes('No action is expected')))
  assert.deepEqual(buttons(), [])

  slots.length = 0
  tree = render()
  assert.deepEqual(buttons().map(text), ['Try it', 'Choose another', 'Not today'], 'remount resets session-local state')
  assert.equal(requests, 0)
}

checkCompletionGate()
checkTransitionsAndLocales()
checkComponentAndIntegration()
console.log('PASS story life bridge eligibility, actions, localization, reset and no-request behavior')

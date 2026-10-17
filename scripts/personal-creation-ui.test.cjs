const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText
}
function plain(file) {
  const module = { exports: {} }
  new Function('module', 'exports', 'require', compile(file))(module, module.exports, id => id.startsWith('.') ? plain(path.join(path.dirname(file), id + '.ts')) : require(id))
  return module.exports
}
function flatten(node) {
  if (node == null || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  return typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node]
}
const label = node => flatten(node.props?.children).filter(value => ['string', 'number'].includes(typeof value)).join('')
async function main() {
  let cursor = 0, tree
  const slots = [], effects = [], requests = [], storage = new Map()
  let loadedStory = null
  let interactionRecordingTarget = ''
  let stopRecordingCalls = 0, dictateCalls = 0
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useMemo(fn) { cursor++; return fn() },
    useEffect(fn, deps) {
      const i = cursor++, previous = slots[i]
      if (!previous || deps.some((value, index) => value !== previous[index])) effects.push(fn)
      slots[i] = deps
    }
  }
  const jsx = (type, props) => ({ type, props: props || {} })
  const module = { exports: {} }
  const mockRequire = id => {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (id === 'next/head' || id === 'next/link' || id.startsWith('../components/')) return { __esModule: true, default: id }
    if (id.endsWith('/story')) return { loadPersonalStory: () => loadedStory }
    if (id.endsWith('/profile')) return { loadMuseProfile: () => null }
    if (id.endsWith('/storyLibrary')) return {}
    if (id.endsWith('/storyLanguage')) return plain('src/lib/storyLanguage.ts')
    if (id.endsWith('/storyRomance')) return plain('src/lib/storyRomance.ts')
    if (id.endsWith('/legalContact')) return { hasExplicitConsent: value => value === true, MUSE_AI_CONSENT_VERSION: 'test' }
    if (id.endsWith('/useNarration')) return { useNarration: () => ({ stop() {} }), NarrationButton: 'narration' }
    if (id.endsWith('/useStoryInteraction')) return { useStoryInteraction: () => ({
      recordingTarget: interactionRecordingTarget, ready: true, error: '',
      stopRecording() { stopRecordingCalls++ }, dictate() { dictateCalls++ }
    }) }
    throw new Error('Unexpected dependency: ' + id)
  }
  const browser = { addEventListener() {}, removeEventListener() {}, localStorage: {
    getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)
  } }
  new Function('module', 'exports', 'require', 'window', 'fetch', 'requestAnimationFrame', compile('src/pages/story.tsx'))(
    module, module.exports, mockRequire, browser, async (_url, options) => {
      requests.push(JSON.parse(options.body))
      return { ok: false, json: async () => ({ error: 'Synthetic generation failure; no paid call.' }) }
    }, callback => callback()
  )
  const flush = async () => {
    for (let i = 0; i < 4; i++) {
      cursor = 0; tree = module.exports.default()
      for (const effect of effects.splice(0)) effect()
      await new Promise(resolve => setImmediate(resolve))
    }
  }
  const nodes = () => flatten(tree).filter(node => node && typeof node === 'object')
  const find = (type, name) => {
    const result = nodes().find(node => node.type === type && label(node) === name)
    assert.ok(result, `Missing ${type}: ${name}`)
    return result
  }
  const click = async name => { find('button', name).props.onClick(); await flush() }
  const visible = () => nodes().filter(node => node.type === 'fieldset' && !node.props.hidden)
  await flush()
  assert.equal(visible().length, 1)
  assert.equal(visible()[0].props.disabled, false)
  assert.equal(requests.length, 0)
  await click('Continue')
  assert.equal(visible().length, 1)
  const language = nodes().find(node => node.props['aria-label'] === 'Story language')
  language.props.onChange({ target: { value: 'ar-SA' } })
  nodes().find(node => node.type === 'textarea').props.onChange({ target: { value: 'A fictional evening in a garden.' } })
  await flush()
  await click('Continue')
  assert.equal(visible().length, 1)
  assert.ok(flatten(visible()[0]).some(node => node === 'A fictional evening in a garden.'))
  await click('Back')
  assert.equal(nodes().find(node => node.type === 'textarea').props.value, 'A fictional evening in a garden.')
  assert.equal(nodes().find(node => node.props['aria-label'] === 'Story language').props.value, 'ar-SA')
  await click('Continue')
  await click('Create my story →')
  assert.equal(requests.length, 0, 'AI consent still required')
  nodes().find(node => node.type === '../components/RomanceOptions').props.onChange('spicy')
  await flush()
  nodes().find(node => node.type === '../components/ExplicitConsent').props.onChange(true)
  await flush()
  await click('Create my story →')
  assert.equal(requests.length, 0, 'Romance confirmation still required')
  nodes().find(node => node.type === '../components/RomanceOptions').props.onConfirm(true)
  await flush()
  await click('Back')
  nodes().find(node => node.type === 'textarea').props.onChange({ target: { value: 'A changed fictional evening.' } })
  await flush()
  await click('Continue')
  assert.equal(nodes().find(node => node.type === '../components/RomanceOptions').props.confirmed, false)
  nodes().find(node => node.type === '../components/RomanceOptions').props.onConfirm(true)
  nodes().find(node => node.type === '../components/ExplicitConsent').props.onChange(true)
  await flush()
  await click('Create my story →')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].language, 'ar-SA')
  assert.equal(requests[0].romance, 'spicy')
  assert.equal(requests[0].romanceConfirmed, true)
  assert.equal(requests[0].need, 'A changed fictional evening.')
  assert.ok(nodes().some(node => node.props.role === 'alert' && label(node).includes('Synthetic generation failure')))
  assert.equal(visible()[0].props.disabled, true, 'Saved pending preparation prevents accidental duplicate generation')
  assert.ok(find('button', 'Sync saved progress (no AI call)'))
  await click('Abandon (no refund)')
  assert.equal(visible()[0].props.disabled, false, 'Abandoning pending preparation restores editing')
  loadedStory = {
    id: 'saved-story', title: 'A quiet door', description: 'A small beginning.', mood: 'curious',
    language: 'en-US', generation: 'ai', currentStep: 0, responses: [],
    scenes: [{ title: 'The Door', body: 'A light glows.', question: 'Will you step inside?', choices: ['Enter'] },
      { title: 'The Garden', body: 'A path opens.', question: 'Where next?', choices: ['Follow'] }]
  }
  interactionRecordingTarget = 'response'
  slots.length = 0
  effects.length = 0
  await flush()
  const activeConsent = nodes().filter(node => node.type === '../components/ExplicitConsent')
  assert.equal(activeConsent.length, 1, 'An active story presents one AI consent prompt before responses')
  activeConsent[0].props.onChange(true)
  await flush()
  nodes().find(node => node.type === 'textarea' && node.props['aria-label'] === 'Editable response')
    .props.onChange({ target: { value: 'I step inside.' } })
  await flush()
  assert.equal(nodes().find(node => node.type === '../components/ExplicitConsent').props.checked, true,
    'Editing response text does not make the story-wide consent prompt recur')
  const holdToSpeak = nodes().find(node => node.type === '../components/HoldToSpeakButton')
  assert.ok(holdToSpeak)
  const stopsBefore = stopRecordingCalls
  holdToSpeak.props.onStop()
  assert.equal(stopRecordingCalls, stopsBefore + 1, 'Releasing hold-to-speak explicitly ends the active recording')
  assert.equal(dictateCalls, 0, 'Stop listening does not restart dictation')
  console.log('PASS personal wizard preserves fields, presents one story-wide consent prompt, and explicitly stops dictation')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

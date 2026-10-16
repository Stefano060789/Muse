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
    if (id.endsWith('/story')) return { loadPersonalStory: () => null }
    if (id.endsWith('/profile')) return { loadMuseProfile: () => null }
    if (id.endsWith('/storyLibrary')) return {}
    if (id.endsWith('/storyLanguage')) return plain('src/lib/storyLanguage.ts')
    if (id.endsWith('/storyRomance')) return plain('src/lib/storyRomance.ts')
    if (id.endsWith('/legalContact')) return { hasExplicitConsent: value => value === true, MUSE_AI_CONSENT_VERSION: 'test' }
    if (id.endsWith('/useNarration')) return { useNarration: () => ({ stop() {} }), NarrationButton: 'narration' }
    if (id.endsWith('/useStoryInteraction')) return { useStoryInteraction: () => ({ stopRecording() {} }) }
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
  console.log('PASS personal wizard preserves fields across steps, never generates on navigation, retains consent/reset boundaries and surfaces failures')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

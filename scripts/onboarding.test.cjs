const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
let passed = 0
function check(name, run) { run(); passed++; console.log(`PASS ${name}`) }
function compile(relative) {
  return ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText
}
function load(relative, mocks = {}) {
  const result = { exports: {} }
  new Function('module', 'exports', 'require', compile(relative))(result, result.exports, name => {
    if (name in mocks) return mocks[name]
    if (name === '../lib/storyRomance') return load('src/lib/storyRomance.ts', mocks)
    throw new Error('Unexpected dependency: ' + name)
  })
  return result.exports
}
function flatten(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  if (typeof node !== 'object') return [node]
  return [node, ...flatten(node.props?.children)]
}
const text = node => flatten(node.props?.children).filter(value => typeof value === 'string' || typeof value === 'number').join('')
function component(relative, extra = {}) {
  const state = [], effects = []
  let cursor = 0, tree
  const react = {
    useRef(initial) { const i = cursor++; return state[i] || (state[i] = { current: initial }) },
    useState(initial) {
      const i = cursor++
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial
      return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }]
    },
    useEffect(effect, deps) {
      const i = cursor++, previous = state[i]
      if (!previous || deps.some((value, index) => previous[index] !== value)) effects.push(effect)
      state[i] = deps
    }
  }
  const jsx = (type, props) => ({ type, props: props || {} })
  const loaded = load(relative, {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/head': { __esModule: true, default: 'head' }, 'next/link': { __esModule: true, default: 'link' }, ...extra
  }).default
  const render = props => {
    cursor = 0; tree = loaded(props)
    for (const effect of effects.splice(0)) effect()
    cursor = 0; tree = loaded(props)
    return tree
  }
  const nodes = () => flatten(tree).filter(item => item && typeof item === 'object')
  const find = (type, label) => {
    const node = nodes().find(node => node.type === type && text(node) === label)
    assert.ok(node, `Missing ${type}: ${label}`)
    return node
  }
  return { render, nodes, find }
}
const sample = load('src/lib/sampleStory.ts')
check('optional romance defaults stay compact and mode changes reset acknowledgment', () => {
  const changes = [], confirmations = []
  const options = component('src/components/RomanceOptions.tsx')
  const props = { confirmed: false, onChange: value => changes.push(value), onConfirm: value => confirmations.push(value) }
  options.render(props)
  assert.ok(options.find('summary', 'Romance (optional)'))
  assert.equal(options.nodes().filter(node => node.type === 'input').length, 0)
  options.nodes().find(node => node.type === 'select').props.onChange({ target: { value: 'spicy' } })
  assert.deepEqual(changes, ['spicy'])
  assert.deepEqual(confirmations, [false])
  options.render({ ...props, value: 'spicy', confirmed: true })
  assert.equal(options.nodes().find(node => node.type === 'input').props.checked, true)
  options.render({ ...props, value: 'spicy', showConfirmation: false })
  assert.equal(options.nodes().filter(node => node.type === 'input').length, 0, 'Shared creator chooses mode first and acknowledges on final step')
  options.nodes().find(node => node.type === 'select').props.onChange({ target: { value: '' } })
  assert.deepEqual(changes, ['spicy', undefined])
})
check('sample is original static fiction with bounded answer handling', () => {
  assert.equal(sample.SAMPLE_STORY.scenes.length, 2)
  for (const answer of ['picnic', ' A PICNIC! ', 'picnic.']) assert.equal(sample.sampleAnswerMatches(answer), true)
  for (const answer of ['', 'not a picnic', '<script>']) assert.equal(sample.sampleAnswerMatches(answer), false)
})
check('demo can be completed and replayed with no API or storage dependencies', () => {
  let browserOnly
  const demo = component('src/pages/demo.tsx', {
    '../lib/sampleStory': sample,
    '../lib/useNarration': { useNarration(_metadata, _mood, _context, options) { browserOnly = options.browserOnly; return { stop() {}, error: '' } } },
    '../components/NarrationControls': { NarrationButton: 'narration' }
  })
  demo.render()
  assert.equal(browserOnly, true, 'Demo must not call a paid cloud narration provider')
  demo.find('button', 'Open sample story').props.onClick(); demo.render()
  demo.find('button', 'Follow the lanterns').props.onClick(); demo.render()
  demo.nodes().find(node => node.props.id === 'sample-answer').props.onChange({ target: { value: 'wrong' } }); demo.render()
  demo.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); demo.render()
  assert.ok(demo.nodes().some(node => node.props.role === 'status'))
  demo.nodes().find(node => node.props.id === 'sample-answer').props.onChange({ target: { value: 'A picnic' } }); demo.render()
  demo.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); demo.render()
  assert.ok(demo.nodes().some(node => node.props.href === '/shared#new'))
  demo.find('button', 'Try the sample again').props.onClick(); demo.render()
  assert.ok(demo.find('button', 'Open sample story'))
})
check('pre-send requires complete preview, answer and attachment checks and resets for uploads', () => {
  let ready
  const preview = component('src/components/PreSendCheck.tsx')
  const props = {
    story: { ownerToken: 'owner', expiresAt: '2099-01-01', brief: { message: 'Private reveal', solution: 'Secret answer', gift: { dedication: 'Public dedication' } }, content: { scenes: [{ title: 'First', body: 'Public body', clue: 'Public clue' }, { title: 'Last', body: 'Last body', clue: 'Last clue' }] } },
    hasMedia: true, hasVoice: true, uploadPending: false, onReady: value => { ready = value }
  }
  preview.render(props)
  assert.equal(ready, false)
  preview.find('button', 'Preview the recipient experience').props.onClick(); preview.render(props)
  assert.equal(JSON.stringify(preview.nodes()).includes('Secret answer'), false)
  assert.equal(JSON.stringify(preview.nodes()).includes('Private reveal'), false)
  preview.find('button', 'Next scene').props.onClick(); preview.render(props)
  preview.find('button', 'I reviewed the clues').props.onClick(); preview.render(props)
  for (const input of preview.nodes().filter(node => node.type === 'input')) input.props.onChange({ target: { checked: true } })
  preview.render(props)
  assert.equal(ready, true)
  preview.render({ ...props, uploadPending: true }); preview.render({ ...props, uploadPending: true })
  assert.equal(ready, false)
  preview.render(props)
  assert.equal(ready, false)
})
check('expired or missing-reveal stories cannot pass the pre-send readiness check', () => {
  let ready
  const preview = component('src/components/PreSendCheck.tsx')
  const props = { story: { ownerToken: 'owner', expiresAt: '2000-01-01', brief: { message: '' }, content: { scenes: [{ title: 'Scene', body: 'Body', clue: 'Clue' }] } }, hasMedia: false, hasVoice: true, uploadPending: false, onReady: value => { ready = value } }
  preview.render(props); preview.find('button', 'Preview the recipient experience').props.onClick(); preview.render(props)
  preview.find('button', 'I reviewed the clues').props.onClick(); preview.render(props)
  for (const input of preview.nodes().filter(node => node.type === 'input')) input.props.onChange({ target: { checked: true } })
  preview.render(props)
  assert.equal(ready, false)
})
check('manifest uses only generic launch URLs and valid original PNG icons', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', 'manifest.webmanifest')))
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.display, 'standalone')
  for (const icon of manifest.icons) {
    const bytes = fs.readFileSync(path.join(root, 'public', icon.src))
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG')
    const [width, height] = icon.sizes.split('x').map(Number)
    assert.equal(bytes.readUInt32BE(16), width)
    assert.equal(bytes.readUInt32BE(20), height)
  }
})
check('service worker claims scope but does not intercept/cache private requests', () => {
  const events = {}
  let activated = false
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8'), {
    self: { addEventListener(name, listener) { events[name] = listener }, skipWaiting() {}, clients: { claim() { activated = true; return Promise.resolve() } } },
    caches: new Proxy({}, { get() { throw new Error('No CacheStorage access allowed') } })
  })
  events.install()
  events.activate({ waitUntil() {} })
  assert.equal(activated, true)
  events.fetch({ request: { url: 'https://muse.example/shared#play=PRIVATE' }, respondWith() { throw new Error('Private requests must remain network-only') } })
})
check('home exposes two clear creation paths, demo and optional personalization', () => {
  const home = component('src/pages/index.tsx', { '../components/InstallApp': { __esModule: true, default: 'install' } })
  home.render()
  for (const href of ['/story', '/shared#new', '/demo', '/myself', '/library']) assert.ok(home.nodes().some(node => node.props.href === href), href)
  assert.ok(home.nodes().some(node => text(node) === 'A story for me'))
  assert.ok(home.nodes().some(node => text(node) === 'A story for someone'))
})
async function installationChecks() {
  const savedWindow = global.window
  const savedNavigator = Object.getOwnPropertyDescriptor(global, 'navigator')
  const savedEnv = process.env.NODE_ENV
  const listeners = new Map()
  const browser = {
    isSecureContext: true,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name)
  }
  const navigator = { userAgent: 'Android Chrome', standalone: false }
  global.window = browser
  Object.defineProperty(global, 'navigator', { configurable: true, value: navigator })
  try {
    const install = component('src/components/InstallApp.tsx')
    install.render()
    let prompted = 0, prevented = false
    listeners.get('beforeinstallprompt')({ preventDefault() { prevented = true }, async prompt() { prompted++ }, userChoice: Promise.resolve({ outcome: 'dismissed' }) })
    install.render()
    await install.find('button', 'Install Muse').props.onClick()
    install.render()
    assert.equal(prompted, 1)
    assert.equal(prevented, true)
    assert.ok(install.nodes().some(node => node.props.role === 'status' && /cancelled/.test(text(node))))
    listeners.get('beforeinstallprompt')({ preventDefault() {}, async prompt() { throw new Error('No prompt') }, userChoice: Promise.resolve({ outcome: 'accepted' }) })
    install.render()
    await install.find('button', 'Install Muse').props.onClick()
    install.render()
    assert.ok(install.nodes().some(node => node.props.role === 'status' && /could not open/.test(text(node))))
    navigator.userAgent = 'iPhone'
    const ios = component('src/components/InstallApp.tsx'); ios.render()
    assert.ok(ios.nodes().some(node => /Share, then Add to Home Screen/.test(text(node))))
    browser.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
    const standalone = component('src/components/InstallApp.tsx'); standalone.render()
    assert.equal(standalone.nodes().length, 0)
    console.log('PASS install prompt dismissal/errors, iPhone instructions and installed mode')
    passed++

    let registrations = 0
    navigator.serviceWorker = { async register(url, options) { registrations++; assert.equal(url, '/sw.js'); assert.equal(options.scope, '/'); throw new Error('Offline') } }
    process.env.NODE_ENV = 'production'
    const support = component('src/components/AppInstallSupport.tsx')
    support.render(); await new Promise(resolve => setImmediate(resolve)); support.render()
    assert.equal(registrations, 1)
    assert.ok(support.nodes().some(node => node.props.role === 'status' && /could not load/.test(text(node))))
    browser.isSecureContext = false
    component('src/components/AppInstallSupport.tsx').render()
    assert.equal(registrations, 1, 'Insecure connections must not register workers')
    process.env.NODE_ENV = 'development'; browser.isSecureContext = true
    component('src/components/AppInstallSupport.tsx').render()
    assert.equal(registrations, 1, 'Development mode must not register workers')
    console.log('PASS worker registration is production/secure only with visible failure')
    passed++
    console.log(`${passed} onboarding/install/pre-send checks passed`)
  } finally {
    global.window = savedWindow
    if (savedNavigator) Object.defineProperty(global, 'navigator', savedNavigator)
    else delete global.navigator
    if (savedEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = savedEnv
  }
}
installationChecks().catch(error => { console.error(error); process.exitCode = 1 })

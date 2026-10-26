const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'my-stories.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
}).outputText
function flatten(node) {
  if (node == null || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  return typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node]
}
const label = node => flatten(node.props?.children).filter(value => typeof value === 'string').join('')
async function mount({ signedIn = false, responseError = '', invalid = false, selectionError = false, cacheError = false } = {}) {
  const state = [], effects = [], requests = [], navigations = [], selections = [], listeners = new Map()
  let cursor = 0, tree
  const entries = [
    { kind: 'personal', id: 'active', updatedAt: '2026-10-26T01:00:00Z', story: { title: 'Active story', journey: { status: 'active' } } },
    { kind: 'personal', id: 'done', updatedAt: '2026-10-25T01:00:00Z', story: { title: 'Completed story', journey: { status: 'concluded' } } },
    { kind: 'personal', id: 'exhausted', updatedAt: '2026-10-24T01:00:00Z', story: { title: 'Saved scenes', journey: { status: 'exhausted' } } },
    { kind: 'shared', id: 'gift', updatedAt: '2026-10-26T02:00:00Z', story: { title: 'Private gift' } }
  ]
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in state)) state[i] = initial
      return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }]
    },
    useRef(initial) { const i = cursor++; return state[i] ||= { current: initial } },
    useEffect(effect, deps) { const i = cursor++; if (!state[i]) { state[i] = deps; effects.push(effect) } }
  }
  const jsx = (type, props) => ({ type, props: props || {} })
  const browser = {
    location: { assign: url => navigations.push(url) },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name)
  }
  const module = { exports: {} }
  new Function('module', 'exports', 'require', 'window', code)(module, module.exports, id => {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (id === 'next/head' || id === 'next/link') return { __esModule: true, default: id }
    if (id.endsWith('/storyLibrary')) return {
      loadStoryLibrary: () => ({ library: { entries: [...entries] }, error: '' }),
      saveLibraryPersonalStory(story) {
        if (cacheError) throw new Error('Cannot save account story in this browser')
        entries.push({ kind: 'personal', id: story.id, updatedAt: '2026-10-27T00:00:00Z', story })
      },
      selectPersonalStory(id) { if (selectionError) throw new Error('Cannot select story'); selections.push(id) }
    }
    if (id.endsWith('/accountClient')) return {
      supabase: { auth: { getSession: async () => ({ data: { session: signedIn ? {} : null } }) } },
      accountFetch: async (_url, init) => {
        requests.push(JSON.parse(init.body))
        return { ok: !responseError, json: async () => responseError ? { error: responseError } : {
          stories: invalid ? null : [{ id: 'cloud', title: 'Cloud story', journey: { status: 'active' } }]
        } }
      }
    }
    throw new Error('Unexpected import ' + id)
  }, browser)
  const flush = async () => {
    for (let i = 0; i < 5; i++) {
      cursor = 0; tree = module.exports.default()
      effects.splice(0).forEach(effect => effect())
      await new Promise(resolve => setImmediate(resolve))
    }
  }
  const nodes = () => flatten(tree).filter(node => typeof node === 'object')
  await flush()
  return { flush, nodes, requests, navigations, selections, listeners,
    async click(text) { const button = nodes().find(node => node.type === 'button' && label(node) === text); assert.ok(button, text); button.props.onClick(); await flush() } }
}
async function main() {
  const hub = await mount()
  assert.equal(hub.requests.length, 0, 'Signed-out hub uses local stories without AI or account calls')
  assert.ok(hub.nodes().some(node => node.props.href === '/story?new=1'))
  assert.ok(hub.nodes().some(node => node.props.href === '/library'))
  assert.ok(!hub.nodes().some(node => label(node) === 'Private gift'))
  await hub.click('Continue story')
  assert.deepEqual(hub.selections, ['active'])
  assert.deepEqual(hub.navigations, ['/story'])
  await hub.click('Read or continue with a new chapter')
  assert.equal(hub.selections.at(-1), 'done')
  assert.equal(hub.navigations.at(-1), '/story', 'Completed account journeys open the new-chapter action outside Archive')
  await hub.click('Read story')
  assert.equal(hub.navigations.at(-1), '/story?read=1')
  const account = await mount({ signedIn: true })
  assert.equal(account.requests.length, 1)
  assert.deepEqual(account.requests[0], { mode: 'journey', action: 'library' })
  assert.ok(account.nodes().some(node => node.type === 'h3' && label(node) === 'Cloud story'))
  const unavailable = await mount({ responseError: 'Please sign in' })
  await unavailable.click('Sync account stories')
  unavailable.listeners.get('focus')()
  await unavailable.flush()
  assert.ok(unavailable.nodes().some(node => node.props.role === 'alert' && label(node).includes('Please sign in')))
  assert.ok(unavailable.nodes().some(node => node.type === 'h3' && label(node) === 'Active story'))
  for (const options of [{ invalid: true }, { cacheError: true }]) {
    const broken = await mount(options)
    await broken.click('Sync account stories')
    assert.ok(broken.nodes().some(node => node.props.role === 'alert'))
  }
  const blocked = await mount({ selectionError: true })
  await blocked.click('Continue story')
  assert.equal(blocked.navigations.length, 0)
  assert.ok(blocked.nodes().some(node => node.props.role === 'alert' && label(node).includes('Cannot select story')))
  console.log('PASS My stories hub: create, resume, read-only completion, account sync, preserved local entries and explicit failures without AI calls')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

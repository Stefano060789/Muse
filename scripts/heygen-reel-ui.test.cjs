const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function flatten(node) {
  if (node == null || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  return typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node]
}
const label = node => flatten(node.props.children).filter(value => typeof value === 'string').join('')
async function main() {
  let cursor = 0, tree
  const slots = [], effects = [], calls = []
  const storage = new Map()
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useEffect(fn, deps) {
      const i = cursor++, previous = slots[i]
      if (!previous || deps.some((value, index) => value !== previous.deps[index])) {
        effects.push(() => {
          previous?.cleanup?.()
          slots[i] = { deps, cleanup: fn() }
        })
      }
      if (!previous) slots[i] = { deps }
    }
  }
  const jsx = (type, props) => ({ type, props: props || {} })
  const fetchAccount = async (_url, init) => {
    const body = JSON.parse(init.body)
    calls.push(body)
    if (body.action === 'availability') return Response.json({ available: true })
    if (body.action === 'create') return Response.json({ token: 'synthetic-signed-reference', status: 'pending' })
    if (body.action === 'status') return Response.json({ status: 'completed' })
    if (body.action === 'video') return new Response('synthetic video', { headers: { 'Content-Type': 'video/mp4' } })
    throw new Error('Unexpected request')
  }
  const source = fs.readFileSync(path.join(root, 'src/components/HeygenStoryReel.tsx'), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const module = { exports: {} }
  const sessionStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
  const window = { setTimeout, clearTimeout }
  const fixture = { id: 'synthetic', title: 'The Lantern', currentStep: 0, scenes: [{ body: 'A lantern glows beside a quiet forest path.' }] }
  new Function('module', 'exports', 'require', 'sessionStorage', 'window', code)(module, module.exports, id => {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (id === '../lib/accountClient') return { accountFetch: fetchAccount }
    throw new Error(`Unexpected dependency ${id}`)
  }, sessionStorage, window)
  const flush = async () => {
    for (let i = 0; i < 4; i++) {
      cursor = 0; tree = module.exports.default({ story: fixture, interfaceLanguage: 'en-US' })
      for (const effect of effects.splice(0)) effect()
      await new Promise(resolve => setImmediate(resolve))
    }
  }
  const nodes = () => flatten(tree).filter(node => node && typeof node === 'object')
  const button = text => nodes().find(node => node.type === 'button' && label(node) === text)
  await flush()
  button('Create my story reel').props.onClick()
  await flush()
  assert.equal(calls.filter(item => item.action === 'create').length, 0, 'Opening the panel does not create a paid reel')
  assert.equal(button('Create video').props.disabled, true)
  const checkbox = nodes().find(node => node.type === 'input' && node.props.type === 'checkbox')
  checkbox.props.onChange({ target: { checked: true } })
  await flush()
  assert.equal(button('Create video').props.disabled, false)
  button('Create video').props.onClick()
  await flush()
  assert.deepEqual(calls.map(item => item.action), ['availability', 'create', 'status', 'video'])
  assert.equal(calls[1].approved, true)
  assert.match(calls[1].prompt, /lantern/i)
  assert.equal(storage.get('muse-heygen-reel:synthetic'), 'synthetic-signed-reference')
  assert.equal(button('Download MP4').props.disabled, true, 'Preview is required before download')
  assert.equal(button('Share reel').props.disabled, true, 'Preview is required before sharing')
  nodes().find(node => node.type === 'video').props.onPlay()
  await flush()
  assert.equal(button('Download MP4').props.disabled, false)
  assert.equal(button('Share reel').props.disabled, false)
  button('Prepare another reel').props.onClick()
  await flush()
  assert.equal(storage.has('muse-heygen-reel:synthetic'), false)
  assert.equal(button('Create video').props.disabled, true, 'Another paid reel needs fresh approval')
  console.log('PASS HeyGen reel requires consent, creates once, previews MP4 and supports another approved reel')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function load(file, mocks) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
  new Function('module', 'exports', 'require', code)(module, module.exports, id =>
    id in mocks ? mocks[id] : id.startsWith('.') ? load(path.join(path.dirname(file), id + '.ts'), mocks) : require(id))
  return module.exports
}
function flatten(node) {
  if (node == null || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  return typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node]
}
async function main() {
  const state = [], refs = [], effects = [], timers = new Map()
  let cursor = 0, refCursor = 0, effectCursor = 0, pendingEffects = [], nodes, requests = [], shared, paidResolve
  let failed = false, available = true, status = 'submitted', readyJob, rejected = false
  const jsx = (type, props) => ({ type, props })
  const globals = new Map(['window', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(global, key)]))
  const component = load('src/components/RunwayStoryShare.tsx', {
    react: {
      useState(initial) {
        const i = cursor++
        if (!(i in state)) state[i] = initial
        return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }]
      },
      useRef(initial) { return refs[refCursor++] ||= { current: initial } },
      useEffect(callback, dependencies) {
        const i = effectCursor++, previous = effects[i]
        if (!previous || dependencies.some((value, index) => value !== previous.dependencies[index])) pendingEffects.push(() => {
          previous?.cleanup?.()
          effects[i] = { dependencies, cleanup: callback() }
        })
      }
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    '../lib/runwayShareFrame': { createRunwayFrameDataUrl: async motif => {
      assert.equal(motif, 'map')
      return 'data:image/jpeg;base64,/9oBAf/Y2Q=='
    } },
    '../lib/accountClient': { accountFetch: async (_url, options) => {
      const body = JSON.parse(options.body)
      requests.push(body)
      if (body.action === 'quote') return Response.json({ available, model: 'grok_imagine_1_5_lite', ratio: 'auto_720p', credits: 16, seconds: 5, estimatedUsd: 0.16, consentVersion: 'runway-share-grok-lite-720p-2026-11-03' })
      if (body.action === 'list') return Response.json({ jobs: readyJob ? [readyJob] : [] })
      if (body.action === 'create') {
        if (rejected) return Response.json({ error: 'Processing permission required' }, { status: 403 })
        if (failed) throw new Error('Network interrupted')
        return await new Promise(resolve => { paidResolve = () => {
          readyJob = { id: body.id, status, credits: 16, createdAt: '2026-11-03T00:00:00Z' }
          resolve(Response.json(readyJob))
        } })
      }
      if (body.action === 'status') {
        readyJob = { ...readyJob, status }
        return Response.json(readyJob)
      }
      if (body.action === 'video') return new Response(new Blob(['encoded MP4 fixture'], { type: 'video/mp4' }))
      throw new Error('Unexpected action')
    } }
  }).default
  const render = () => {
    cursor = 0; refCursor = 0; effectCursor = 0
    nodes = flatten(component({ title: 'The Map of Forgotten Winds PRIVATE TITLE', passage: 'PRIVATE ANSWER',
      caption: 'Reviewed local caption', language: 'en-US', motif: 'map' }))
    const pending = pendingEffects; pendingEffects = []; pending.forEach(effect => effect())
  }
  const flush = async () => { for (let i = 0; i < 5; i++) { render(); await new Promise(resolve => setImmediate(resolve)) } }
  const button = name => nodes.find(node => node?.type === 'button' && node.props.children === name)
  const checkbox = () => nodes.find(node => node?.type === 'input')
  try {
    let timerId = 0
    global.window = { setTimeout(callback) { timers.set(++timerId, callback); return timerId }, clearTimeout(id) { timers.delete(id) } }
    Object.defineProperty(global, 'navigator', { configurable: true, value: { canShare: () => true, share: async value => { shared = value } } })
    await flush()
    assert.equal(requests.length, 0, 'Collapsed premium studio sends nothing')
    button('Bring this moment to life · Runway').props.onClick()
    await flush()
    assert.match(nodes.find(node => node?.type === 'textarea').props.value, /parchment map/)
    assert.ok(!nodes.find(node => node?.type === 'textarea').props.value.includes('PRIVATE'))
    assert.equal(button('Generate cinematic clip').props.disabled, true)
    assert.equal(requests.filter(row => row.action === 'create').length, 0, 'Opening studio only retrieves settings/jobs')
    checkbox().props.onChange({ target: { checked: true } }); await flush()
    nodes.find(node => node?.type === 'textarea').props.onChange({ target: { value: 'A parchment map moving gently in a warm breeze, cinematic illustrated storybook style.' } })
    await flush()
    assert.equal(checkbox().props.checked, false, 'Editing the approved brief clears approval')
    checkbox().props.onChange({ target: { checked: true } }); await flush()
    button('Generate cinematic clip').props.onClick()
    button('Generate cinematic clip').props.onClick()
    await flush()
    assert.equal(requests.filter(row => row.action === 'create').length, 1, 'Double taps never create a second paid request')
    const sent = requests.find(row => row.action === 'create')
    assert.deepEqual(Object.keys(sent).sort(), ['action', 'approved', 'approvedCredits', 'brief', 'consentVersion', 'frame', 'id'])
    assert.equal(sent.approvedCredits, 16)
    assert.match(sent.frame, /^data:image\/jpeg;base64,/)
    assert.ok(!JSON.stringify(sent).includes('PRIVATE'))
    paidResolve(); await flush()
    assert.ok(nodes.some(node => node?.props?.role === 'status' && /preparing your clip/.test(node.props.children)))
    assert.equal(button('Generate cinematic clip'), undefined)
    assert.equal(timers.size, 1)
    status = 'ready'
    const callback = [...timers.values()][0]
    callback(); await flush()
    assert.ok(nodes.some(node => node?.type === 'video'))
    assert.ok(!nodes.some(node => node?.type === 'textarea'), 'Current draft is never attributed to a saved video')
    assert.equal(button('Download cinematic MP4').props.disabled, true)
    nodes.find(node => node?.type === 'video').props.onPlay(); await flush()
    assert.equal(button('Download cinematic MP4').props.disabled, false)
    await button('Share cinematic MP4').props.onClick()
    assert.equal(shared.files[0].type, 'video/mp4')
    assert.equal(shared.text, 'Reviewed local caption')
    button('Prepare another clip').props.onClick(); await flush()
    assert.equal(checkbox().props.checked, false)
    failed = true
    checkbox().props.onChange({ target: { checked: true } }); await flush()
    button('Generate cinematic clip').props.onClick(); await flush()
    assert.ok(nodes.some(node => node?.props?.role === 'alert' && /Network interrupted/.test(node.props.children)))
    assert.equal(button('Generate cinematic clip'), undefined, 'An ambiguous request cannot silently retry')
    assert.equal(requests.filter(row => row.action === 'create').length, 2)
    button('Prepare another clip').props.onClick(); await flush()
    failed = false; rejected = true
    checkbox().props.onChange({ target: { checked: true } }); await flush()
    button('Generate cinematic clip').props.onClick(); await flush()
    assert.ok(nodes.some(node => node?.props?.role === 'alert' && /Processing permission required/.test(node.props.children)))
    assert.ok(button('Generate cinematic clip'), 'Permission rejection does not fabricate an unknown paid job')
    assert.equal(checkbox().props.checked, false)
    button('Close cinematic studio').props.onClick(); await flush()
    assert.equal(timers.size, 0)
    for (const effect of effects) effect.cleanup?.()
    console.log('PASS Runway studio quote/privacy, explicit cost approval, edited-brief reset, double taps, read-only polling, actual video playback gating, native file sharing, unknown request handling and cleanup')
  } finally {
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(global, key, descriptor)
      else delete global[key]
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })

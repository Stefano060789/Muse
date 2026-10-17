const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'StudioNarration.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
}).outputText
function flatten(node) {
  if (!node || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  return typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node]
}
function mount(extra = {}) {
  const slots = [], effects = [], cleanups = new Map(), calls = [], revoked = []
  let cursor = 0, tree, serial = 0
  const audioRef = { current: { pause() { calls.push('pause') } } }
  const props = {
    sceneIndex: 1, audioRef, beforeListen() { calls.push('beforeListen') },
    check: async () => { calls.push('check'); return { enabled: true, ready: false } },
    generate: async () => { calls.push('generate'); return { enabled: true, ready: true } },
    load: async () => { calls.push('load'); return new Blob(['synthetic mp3'], { type: 'audio/mpeg' }) },
    ...extra
  }
  const jsx = (type, props) => ({ type, props: props || {} })
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial } },
    useEffect(effect, deps) {
      const index = cursor++, old = slots[index]
      if (!old || deps.some((value, i) => value !== old[i])) effects.push(() => {
        cleanups.get(index)?.()
        const cleanup = effect()
        if (cleanup) cleanups.set(index, cleanup); else cleanups.delete(index)
      })
      slots[index] = deps
    }
  }
  const module = { exports: {} }
  new Function('module', 'exports', 'require', 'URL', source)(module, module.exports,
    id => id === 'react' ? react : id === 'react/jsx-runtime' ? { jsx, jsxs: jsx, Fragment: 'fragment' } : require(id),
    { createObjectURL() { return `blob:synthetic-${++serial}` }, revokeObjectURL(value) { revoked.push(value) } })
  const render = () => { cursor = 0; tree = module.exports.default(props); return tree }
  const flush = async () => {
    for (let i = 0; i < 4; i++) {
      render()
      effects.splice(0).forEach(effect => effect())
      await new Promise(resolve => setImmediate(resolve))
    }
    render()
  }
  const nodes = () => flatten(tree).filter(value => typeof value === 'object')
  const button = text => nodes().find(node => node.type === 'button' && flatten(node.props.children).includes(text))
  return { calls, props, revoked, flush, button, nodes, unmount() { cleanups.forEach(cleanup => cleanup()); cleanups.clear() } }
}
async function main() {
  const owner = mount({ owner: true })
  await owner.flush()
  assert.deepEqual(owner.calls, [], 'Mounting must not query or generate paid audio')
  owner.button('Check Studio availability').props.onClick()
  await owner.flush()
  const prepare = owner.button('Prepare this scene\'s Studio audio')
  assert.equal(prepare.props.disabled, true)
  prepare.props.onClick()
  await owner.flush()
  assert.ok(!owner.calls.includes('generate'), 'Unchecked consent blocks generation even when handler is invoked')
  owner.nodes().find(node => node.type === 'input').props.onChange({ target: { checked: true } })
  await owner.flush()
  owner.button('Prepare this scene\'s Studio audio').props.onClick()
  await owner.flush()
  assert.equal(owner.calls.filter(value => value === 'generate').length, 1)
  assert.ok(owner.button('Load Studio audio'))
  owner.unmount()

  const disabled = mount({ owner: true, check: async () => ({ enabled: false, ready: false }) })
  await disabled.flush()
  disabled.button('Check Studio availability').props.onClick()
  await disabled.flush()
  assert.ok(!disabled.nodes().some(node => node.type === 'input'))
  disabled.unmount()
  const blocked = mount({ owner: true, check: async () => ({ enabled: true, ready: false, blocked: true, message: 'A failed attempt stays charged.' }) })
  await blocked.flush()
  blocked.button('Check Studio availability').props.onClick()
  await blocked.flush()
  assert.ok(!blocked.nodes().some(node => node.type === 'input'), 'Failed/pending scenes cannot offer a new paid attempt')
  blocked.unmount()

  const generationFailure = mount({ owner: true, generate: async () => { throw new Error('Preparation failed; reservation stays charged') } })
  await generationFailure.flush()
  generationFailure.button('Check Studio availability').props.onClick()
  await generationFailure.flush()
  generationFailure.nodes().find(node => node.type === 'input').props.onChange({ target: { checked: true } })
  await generationFailure.flush()
  generationFailure.button('Prepare this scene\'s Studio audio').props.onClick()
  await generationFailure.flush()
  assert.ok(generationFailure.nodes().some(node => node.props.role === 'alert'))
  assert.ok(!generationFailure.button('Prepare this scene\'s Studio audio'), 'Generation errors require a fresh status check rather than another attempt')
  generationFailure.unmount()

  const recipient = mount()
  await recipient.flush()
  assert.deepEqual(recipient.calls, [])
  assert.ok(!recipient.button('Check Studio availability'))
  recipient.button('Load Studio audio').props.onClick()
  await recipient.flush()
  assert.equal(recipient.calls.filter(value => value === 'load').length, 1)
  const audio = recipient.nodes().find(node => node.type === 'audio')
  assert.ok(audio.props.controls)
  assert.equal(audio.props.autoPlay, undefined)
  assert.equal(audio.props.preload, 'metadata')
  audio.props.onPlay()
  recipient.props.stopSignal = true
  await recipient.flush()
  assert.ok(recipient.calls.includes('pause'))
  recipient.unmount()
  assert.deepEqual(recipient.revoked, ['blob:synthetic-1'])

  const failure = mount({ load: async () => { throw new Error('No prepared recording') } })
  await failure.flush()
  failure.button('Load Studio audio').props.onClick()
  await failure.flush()
  assert.ok(failure.nodes().some(node => node.props.role === 'alert'))
  assert.ok(!failure.nodes().some(node => node.type === 'audio'))
  assert.ok(!failure.calls.includes('generate'))
  failure.unmount()

  let finish, signal
  const stale = mount({ load: (_index, abort) => { signal = abort; return new Promise(resolve => { finish = resolve }) } })
  await stale.flush()
  stale.button('Load Studio audio').props.onClick()
  stale.unmount()
  assert.equal(signal.aborted, true)
  finish(new Blob(['stale'], { type: 'audio/mpeg' }))
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(stale.revoked, [])
  console.log('PASS Studio UI: no automatic requests, disabled configuration, fresh consent, explicit load/play, errors without fallback, playback stop and stale-request cleanup')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

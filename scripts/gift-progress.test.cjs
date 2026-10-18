const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'GiftProgress.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
}).outputText
function flatten(node) {
  if (node == null || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  return typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node]
}
function mount(load, adventure = false, compact = false) {
  const slots = [], effects = [], cleanups = []
  let cursor = 0, tree
  const jsx = (type, props) => ({ type, props: props || {} })
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = initial
      return [slots[i], value => { slots[i] = value }]
    },
    useRef(initial) { return slots[cursor++] ||= { current: initial } },
    useEffect(effect) { if (!slots[cursor++]) { slots[cursor - 1] = true; effects.push(effect) } }
  }
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', source)(mod, mod.exports, id =>
    id === 'react' ? react : id === 'react/jsx-runtime' ? { jsx, jsxs: jsx, Fragment: 'fragment' } : require(id))
  const render = () => { cursor = 0; tree = mod.exports.default({ load, adventure, compact, sceneCount: 3 }); return tree }
  const flush = async () => { render(); effects.splice(0).forEach(effect => cleanups.push(effect())); await new Promise(resolve => setImmediate(resolve)); render() }
  const nodes = () => flatten(tree).filter(node => typeof node === 'object')
  return { flush, nodes, text: () => flatten(tree).filter(node => typeof node !== 'object').join(' '),
    button: () => nodes().find(node => node.type === 'button'), unmount: () => cleanups.forEach(cleanup => cleanup?.()) }
}
async function main() {
  let calls = 0, fail = false, release
  const summary = { opened: 4, inProgress: 2, solved: 1, skipped: 1, furthestScene: 1 }
  const ui = mount(async () => { calls++; if (fail) throw new Error('Progress unavailable'); return summary })
  await ui.flush()
  assert.equal(calls, 0, 'Mounting does not fetch or poll')
  ui.button().props.onClick()
  await ui.flush()
  assert.equal(calls, 1)
  assert.match(ui.text(), /Scene 2 of 3 reached ·  Finished/)
  assert.equal(ui.nodes().filter(node => node.type === 'dd').length, 0, 'No playthrough counters clutter the result')
  assert.match(ui.text(), /does not measure audio listened to/)
  assert.match(ui.text(), /earlier recipient links/)
  await ui.flush()
  assert.equal(calls, 1, 'Rerendering does not poll')
  fail = true
  ui.button().props.onClick()
  await ui.flush()
  assert.ok(ui.nodes().some(node => node.props.role === 'alert'))
  assert.equal(ui.nodes().filter(node => node.type === 'dd').length, 0, 'Failed refresh cannot show stale success-shaped counts')
  ui.unmount()
  const empty = mount(async () => ({ opened: 0, inProgress: 0, solved: 0, skipped: 0, furthestScene: null }))
  await empty.flush(); empty.button().props.onClick(); await empty.flush()
  assert.match(empty.text(), /Not started/)
  assert.ok(!empty.text().includes('Furthest scene reached'))
  empty.unmount()
  const live = mount(async () => summary, true)
  await live.flush(); live.button().props.onClick(); await live.flush()
  assert.ok(!live.text().includes('Scene 2 of'), 'Live adventure turns are not measured as prepared scenes')
  assert.match(live.text(), /Live adventures do not have a fixed scene count/)
  live.unmount()
  const compact = mount(async () => summary, false, true)
  await compact.flush()
  assert.match(compact.text(), /View story progress/)
  assert.equal(compact.nodes().filter(node => node.type === 'button').length, 1)
  assert.ok(!compact.text().includes('Private overview'), 'Compact card stays uncluttered before checking')
  compact.button().props.onClick()
  await compact.flush()
  assert.match(compact.text(), /Refresh story progress/)
  assert.match(compact.text(), /Scene 2 of 3 reached/)
  assert.equal(compact.nodes().filter(node => node.type === 'dd').length, 0)
  compact.unmount()
  for (const furthestScene of [0, 2, 50]) {
    const active = mount(async () => ({ opened: 1, inProgress: 1, solved: 0, skipped: 0, furthestScene }))
    await active.flush(); active.button().props.onClick(); await active.flush()
    assert.match(active.text(), new RegExp(`Scene ${Math.min(furthestScene + 1, 3)} of 3 reached`))
    assert.match(active.text(), /Not finished/, 'Last scene reached is not a finished story')
    active.unmount()
  }
  const revealed = mount(async () => ({ opened: 1, inProgress: 0, solved: 0, skipped: 1, furthestScene: 0 }))
  await revealed.flush(); revealed.button().props.onClick(); await revealed.flush()
  assert.match(revealed.text(), /Finished/)
  revealed.unmount()
  const pending = mount(() => new Promise(resolve => { release = resolve }))
  await pending.flush()
  const click = pending.button().props.onClick
  click(); click(); await pending.flush()
  assert.equal(pending.button().props.disabled, true)
  pending.unmount()
  release(summary)
  await pending.flush()
  assert.equal(pending.nodes().filter(node => node.type === 'dd').length, 0, 'Late response cannot resurrect an unmounted panel')
  console.log('PASS private progress UI: manual refresh, bounded scene display, distinct outcomes, no polling, errors and lifecycle')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

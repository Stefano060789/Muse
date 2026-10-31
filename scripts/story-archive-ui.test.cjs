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
  new Function('module', 'exports', 'require', code)(module, module.exports, id => {
    if (id in mocks) return mocks[id]
    if (id.startsWith('.')) return load(path.join(path.dirname(file), id + '.ts'), mocks)
    return require(id)
  })
  return module.exports
}
const tick = () => new Promise(resolve => setImmediate(resolve))
async function main() {
  const slots = [], requests = [], saves = []
  let cursor = 0, refreshes = 0, deny = false, status = 200, release
  const jsx = (type, props) => ({ type, props })
  const component = load('src/components/StoryArchiveButton.tsx', {
    react: {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value }] },
      useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } }
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    '../lib/storyLibrary': { validatePersonalStory: value => value, saveLibraryPersonalStory: value => saves.push(value) },
    '../lib/accountClient': { async accountFetch(_url, options) {
      const body = JSON.parse(options.body)
      requests.push(body)
      await new Promise(resolve => { release = resolve })
      return { ok: !deny, status, json: async () => deny ? { error: 'Permission denied' } : {
        story: { ...story, archived: body.action === 'archive' }
      } }
    } }
  }).default
  let story = { id: 'fixture', title: 'Garden', journey: { capability: 'private', revision: 2 } }
  function nodes(node) {
    if (node == null || typeof node !== 'object') return []
    if (Array.isArray(node)) return node.flatMap(nodes)
    return [node, ...nodes(node.props?.children)]
  }
  function render(language = 'it-IT') {
    cursor = 0
    return nodes(component({ story, language, onSaved() { refreshes++ } }))
  }
  let button = render().find(node => node.type === 'button')
  assert.equal(button.props.children, 'Chiudi storia')
  button.props.onClick(); button.props.onClick()
  assert.equal(requests.length, 1, 'Double click only moves once')
  assert.equal(render().find(node => node.type === 'button').props.disabled, true)
  release(); await tick()
  assert.equal(saves[0].archived, true)
  assert.equal(refreshes, 1)
  assert.equal(requests[0].action, 'archive')
  assert.ok(!('consentVersion' in requests[0]), 'Moving is not an AI operation')
  story = saves[0]
  button = render().find(node => node.type === 'button')
  assert.equal(button.props.children, 'Riporta nelle mie storie')
  button.props.onClick(); release(); await tick()
  assert.equal(requests[1].action, 'restore')
  assert.equal(saves[1].archived, false)
  deny = true
  render().find(node => node.type === 'button').props.onClick()
  release(); await tick()
  assert.equal(saves.length, 2, 'Failed server move never alters browser copy')
  assert.ok(render().some(node => node.props.role === 'alert' && node.props.children === 'Permission denied'))
  assert.equal(render().filter(node => node.type === 'button').length, 1, 'No local fallback for authorization or generic failures')
  status = 404
  render().find(node => node.type === 'button').props.onClick()
  release(); await tick()
  assert.equal(saves.length, 2, 'Unavailable server story is not automatically moved locally')
  const localMove = render().find(node => node.type === 'button' && node.props.children === 'Sposta solo la copia del browser')
  assert.ok(localMove)
  localMove.props.onClick(); await tick()
  assert.equal(saves.at(-1).archived, false)
  assert.deepEqual(saves.at(-1).journey, story.journey, 'Browser-only restore retains original journey access and progress')
  assert.equal(requests.length, 4, 'Explicit local move makes no extra network call')
  story = { id: 'legacy', title: 'Local' }
  render().find(node => node.type === 'button').props.onClick()
  await tick()
  assert.equal(requests.length, 4, 'Legacy stories move locally without a server call')
  assert.equal(saves.at(-1).archived, true)
  for (const language of ['en-US', 'it-IT', 'es-ES', 'zh-CN', 'hi-IN', 'uk-UA', 'ar-SA']) {
    assert.ok(load('src/lib/storyArchiveCopy.ts', {}).storyArchiveCopy(language).restore.trim())
  }
  console.log('PASS archive/restore buttons, localization, double-click safety, server errors and local-only legacy behavior')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

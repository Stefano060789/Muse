const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function load(file, mocks, cache = new Map()) {
  if (cache.has(file)) return cache.get(file)
  const module = { exports: {} }
  cache.set(file, module.exports)
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
  new Function('module', 'exports', 'require', code)(module, module.exports, id =>
    id in mocks ? mocks[id] : id.startsWith('.') ? load(path.join(path.dirname(file), id + '.ts'), mocks, cache) : require(id))
  cache.set(file, module.exports)
  return module.exports
}
function flatten(node) {
  if (node == null || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  return typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node]
}
const jsx = (type, props) => ({ type, props })
const copies = load('src/lib/runwayShareCopy.ts', {})
const component = load('src/components/RunwayStoryShare.tsx', {
  '../lib/runwayShareCopy': copies,
  'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' }
}).default
for (const language of ['en-US', 'it-IT', 'es-ES', 'zh-CN', 'hi-IN', 'uk-UA', 'ar-SA']) {
  const nodes = flatten(component({
    title: 'Private story title', passage: 'Private story text', caption: 'Caption',
    language, motif: 'map'
  }))
  const copy = copies.runwayShareCopy(language)
  assert.ok(nodes.some(node => node?.props?.role === 'status' && node.props.children === copy.unavailable))
  assert.ok(!nodes.some(node => ['button', 'textarea', 'input', 'video'].includes(node?.type)),
    `${language} must not present generation or replacement controls`)
}
assert.match(copies.runwayShareCopy('en-US').unavailable, /disabled pending commercial entitlement review/)
assert.match(copies.runwayShareCopy('en-US').commercialStatus, /Muse does not send prompts/)
console.log('PASS Runway UI reports the disabled state in every supported language without generation or fallback controls')

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'PersonalStoryShareCard.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
}).outputText
const slots = []
let cursor = 0, accepted = true, calls = 0
const jsx = (type, props) => ({ type, props })
const moduleUnderTest = { exports: {} }
new Function('module', 'exports', 'require', code)(moduleUnderTest, moduleUnderTest.exports, id => {
  if (id === 'react') return { useState(initial) {
    const i = cursor++
    if (!(i in slots)) slots[i] = initial
    return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
  } }
  if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
  if (id.endsWith('/accountClient')) return { accountFetch() { calls++; throw new Error('No generation expected') } }
  if (id.endsWith('/personalStoryShareCopy')) return { personalStoryShareText: key => key, personalStoryMoodText: mood => mood }
  if (id.endsWith('/personalStoryShareVisual')) return {}
  if (id.endsWith('/providerConsent')) return { PROVIDER_CONSENT_VERSION: 'fixture' }
  if (id.endsWith('/useShareConsent')) return { useShareConsent: () => ({ accepted, ready: true, saving: false }) }
  if (id.endsWith('/useAccountPermissions')) return { useAccountPermissions: () => ({ managed: false, ready: true }) }
  if (id.endsWith('/registrationCopy')) return { registrationCopy: () => ({ settings: 'Settings' }) }
  if (id.endsWith('/shareConsentCopy')) return { shareConsentCopy: () => ({ remembered: 'remembered', allow: 'allow' }) }
  throw new Error('Unexpected dependency: ' + id)
})
function flatten(node) {
  if (node == null || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  return typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node]
}
function render() {
  cursor = 0
  return flatten(moduleUnderTest.exports.default({ story: { title: 'Garden', mood: 'relaxed' }, interfaceLanguage: 'it-IT' }))
}
let nodes = render()
assert.deepEqual(nodes.filter(node => node.type === 'button').map(node => node.props.children), ['shareStoryTitle'])
assert.ok(!nodes.some(node => ['h4', 'p', 'label'].includes(node.type)))
nodes.find(node => node.type === 'button').props.onClick()
nodes = render()
assert.ok(!nodes.includes('remembered'))
assert.ok(!nodes.includes('shareStoryDescription'))
assert.ok(nodes.some(node => node.type === 'button' && node.props.children === 'createTeaser' && !node.props.disabled))
accepted = false
nodes = render()
assert.ok(nodes.some(node => node.type === 'input' && node.props.type === 'checkbox'))
assert.ok(nodes.some(node => node.type === 'button' && node.props.children === 'createTeaser' && node.props.disabled))
assert.equal(calls, 0, 'Opening share options never consumes an AI interaction')
nodes.find(node => node.type === 'button').props.onClick()
assert.equal(render().filter(node => node.type === 'button').length, 1)
console.log('PASS compact share button reveals options only on demand and preserves consent gating')

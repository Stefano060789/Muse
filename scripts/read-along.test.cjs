const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '..', 'src/components/ReadAlongText.tsx'), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
}).outputText
const originalLoad = Module._load
const componentModule = { exports: {} }
try {
  Module._load = function (name, ...args) {
    if (name === 'react/jsx-runtime') return {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
      Fragment: 'fragment'
    }
    return originalLoad.call(this, name, ...args)
  }
  new Function('module', 'exports', 'require', code)(componentModule, componentModule.exports, require)
} finally { Module._load = originalLoad }

const flatten = value => Array.isArray(value) ? value.flatMap(flatten)
  : value && typeof value === 'object' ? [value, ...flatten(value.props?.children)]
    : [value]
const visibleText = result => flatten(result).filter(value => typeof value === 'string').join('')
const read = componentModule.exports.default
const moving = read({ text: 'The quiet door opens', startAt: 0, position: 7, active: true })
assert.equal(visibleText(moving), 'The quiet', 'Future words stay hidden until playback reaches them')
const activeWord = flatten(moving).find(node => node && typeof node === 'object' && node.type === 'span' && node.props.children === 'quiet')
assert.equal(activeWord.props.style.background, '#f2d58a', 'The currently spoken word is highlighted')
assert.equal(visibleText(read({ text: 'The quiet door opens', startAt: 0, position: 0, active: false })), 'The quiet door opens',
  'All story text is readable when narration is not playing')
assert.equal(visibleText(read({ text: '你好世界', startAt: 0, position: 1, active: true })), '你好',
  'Languages without spaces reveal characters progressively instead of showing the full sentence at once')
console.log('PASS progressive read-along reveals words as narration advances')
const passageModule = { exports: {} }
const passageCode = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src/components/StoryPassage.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
}).outputText
new Function('module', 'exports', 'require', passageCode)(passageModule, passageModule.exports, name => {
  if (name === './ReadAlongText') return { __esModule: true, default: read }
  if (name === 'react/jsx-runtime') return { jsx: (type, props) => typeof type === 'function' ? type(props) : ({ type, props }) }
  throw new Error('Unexpected passage dependency ' + name)
})
const passage = passageModule.exports.default
const scene = { text: 'The quiet door opens', narrationText: '', position: 0, active: false }
assert.equal(visibleText(passage({ ...scene, mode: null })), '', 'No story text before choosing Read or Listen')
assert.equal(visibleText(passage({ ...scene, mode: 'read' })), scene.text, 'Read reveals all text immediately')
assert.equal(visibleText(passage({ ...scene, mode: 'listen' })), '', 'Listen never flashes the full text while audio loads or fails')
assert.equal(visibleText(passage({ ...scene, mode: 'listen', narrationText: scene.text, position: 7, active: true })), 'The quiet')
assert.equal(visibleText(passage({ ...scene, mode: 'listen', narrationText: scene.text, position: 7 })), 'The quiet', 'Pausing or idling never reveals future words')
assert.equal(visibleText(passage({ ...scene, mode: 'listen', narrationText: scene.text, position: scene.text.length })), scene.text, 'Completed listening retains the revealed text')
console.log('PASS story passage waits for a choice and never flashes unread text in Listen')
const modeModule = { exports: {} }
new Function('module', 'exports', 'require', ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src/components/StoryModeControl.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
}).outputText)(modeModule, modeModule.exports, name => {
  if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
  throw new Error('Unexpected mode dependency ' + name)
})
const changes = []
const controls = modeModule.exports.default({ mode: null, onChange: value => changes.push(value) })
assert.equal(controls.props['aria-label'], 'How would you like to experience this scene?')
const buttons = flatten(controls).filter(node => node?.type === 'button')
assert.deepEqual(buttons.map(node => node.props['aria-label']), ['Read this scene', 'Listen to this scene'])
assert.equal(visibleText(buttons[0]), 'Read this scene')
assert.equal(visibleText(buttons[1]), 'Listen to this scene')
assert.ok(buttons.every(node => node.props['aria-pressed'] === false))
buttons.forEach(node => node.props.onClick())
assert.deepEqual(changes, ['read', 'listen'])
console.log('PASS prominent experience controls describe the immediate Read and Listen actions')

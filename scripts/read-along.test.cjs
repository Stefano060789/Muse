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

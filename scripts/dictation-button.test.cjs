const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'src/components/DictationButton.tsx'), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
}).outputText
const originalLoad = Module._load
const slots = []
const pendingEffects = []
const windowEvents = new Map(), documentEvents = new Map()
const eventTarget = handlers => ({
  addEventListener(name, handler) { handlers.set(name, handler) },
  removeEventListener(name, handler) { if (handlers.get(name) === handler) handlers.delete(name) }
})
let cursor = 0
const componentModule = { exports: {} }
try {
  Module._load = function (name, ...args) {
    if (name === 'react') return {
      useEffect(effect, deps) {
        const index = cursor++, previous = slots[index]
        if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
          pendingEffects.push(() => {
            previous?.cleanup?.()
            slots[index] = { deps, cleanup: effect() }
          })
        }
      },
      useRef(initial) { const index = cursor++; return slots[index] || (slots[index] = { current: initial }) }
    }
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
    return originalLoad.call(this, name, ...args)
  }
  new Function('module', 'exports', 'require', 'window', 'document', code)(
    componentModule, componentModule.exports, require, eventTarget(windowEvents), eventTarget(documentEvents))
} finally { Module._load = originalLoad }

let starts = 0, stops = 0
const render = options => {
  cursor = 0
  const props = componentModule.exports.default({ onStart: () => { starts++ }, onStop: () => { stops++ }, ...options }).props
  for (const effect of pendingEffects.splice(0)) effect()
  return props
}
const idle = render({ label: 'Dictate answer', stopLabel: 'Stop and use answer' })
assert.equal(idle.children, 'Dictate answer')
assert.equal(idle['aria-label'], 'Dictate answer')
assert.equal(idle.onPointerDown, undefined, 'Dictation does not depend on press duration or pointer capture')
idle.onClick()
assert.equal(starts, 1, 'A click starts dictation')
idle.onClick()
assert.equal(starts, 1, 'Repeated clicks before a rerender cannot start duplicate recognition')
assert.equal(stops, 1, 'A second click stops dictation')
const recording = render({ recording: true, label: 'Dictate answer', stopLabel: 'Stop and use answer' })
assert.equal(recording['aria-pressed'], true)
assert.equal(recording['aria-label'], 'Stop and use answer')
recording.onClick()
assert.equal(stops, 2, 'The active button toggles recognition off')
const finishing = render({ recording: true, stopping: true, stoppingLabel: 'Finishing dictation…' })
assert.equal(finishing.disabled, true)
assert.equal(finishing['aria-busy'], true)
assert.equal(finishing['aria-label'], 'Finishing dictation…')

const disabled = render({ disabled: true })
disabled.onClick()
assert.equal(starts, 1, 'Disabled controls cannot start dictation')
let latestStops = 0
const start = render({ onStop() { latestStops++ } })
start.onClick()
render({ recording: true, onStop() { latestStops++ } })
const beforeDisable = latestStops
render({ recording: true, disabled: true, onStop() { latestStops++ } })
assert.equal(latestStops, beforeDisable + 1, 'Becoming disabled stops active dictation')

const activeBeforeUnmount = render({ recording: false, onStop() { latestStops++ } })
activeBeforeUnmount.onClick()
const beforeUnmount = latestStops
for (const slot of slots) slot?.cleanup?.()
assert.equal(latestStops, beforeUnmount + 1, 'Unmount stops active dictation')
assert.equal(windowEvents.size + documentEvents.size, 0, 'Unmount removes release listeners')
console.log('PASS dictation click toggle, repeated clicks, labels, disable, latest callback and unmount behavior')

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'src/components/HoldToSpeakButton.tsx'), 'utf8')
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
const pointer = render({})
let captured = false
pointer.onPointerDown({
  isPrimary: true, button: 0, pointerId: 1, preventDefault() {},
  currentTarget: { setPointerCapture() { captured = true } }
})
assert.equal(captured, true)
assert.equal(starts, 1, 'Pressing starts dictation')
pointer.onPointerUp()
pointer.onLostPointerCapture()
assert.equal(stops, 1, 'Releasing stops dictation only once')

const keyboard = render({})
keyboard.onKeyDown({ key: ' ', repeat: false, preventDefault() {} })
keyboard.onKeyDown({ key: ' ', repeat: true, preventDefault() {} })
assert.equal(starts, 2, 'Keyboard hold starts dictation without repeat')
keyboard.onKeyUp({ key: ' ' })
assert.equal(stops, 2, 'Keyboard release stops dictation')

const cancelled = render({})
cancelled.onPointerDown({
  isPrimary: true, button: 0, pointerId: 2, preventDefault() {},
  currentTarget: { setPointerCapture() {} }
})
cancelled.onPointerCancel()
assert.equal(stops, 3, 'Pointer cancellation also stops dictation')

const disabled = render({ disabled: true })
disabled.onPointerDown({
  isPrimary: true, button: 0, pointerId: 3, preventDefault() {},
  currentTarget: { setPointerCapture() {} }
})
assert.equal(starts, 3, 'Disabled controls cannot start dictation')
const press = options => {
  const button = render(options)
  button.onPointerDown({ isPrimary: true, button: 0, pointerId: 4, preventDefault() {}, currentTarget: { setPointerCapture() {} } })
  return button
}
for (const [events, name] of [
  [windowEvents, 'pointerup'], [windowEvents, 'pointercancel'], [windowEvents, 'blur'], [documentEvents, 'visibilitychange']
]) {
  const button = press({})
  const before = stops
  events.get(name)()
  button.onLostPointerCapture()
  assert.equal(stops, before + 1, `${name} releases the microphone exactly once`)
}
press({})
const beforeDisable = stops
render({ disabled: true })
assert.equal(stops, beforeDisable + 1, 'Becoming disabled releases an active hold')
let latestStops = 0
press({})
render({ onStop() { latestStops++ } })
windowEvents.get('pointerup')()
assert.equal(latestStops, 1, 'Global release uses the latest callback')
press({})
const beforeUnmount = stops
for (const slot of slots) slot?.cleanup?.()
assert.equal(stops, beforeUnmount + 1, 'Unmount releases an active hold')
assert.equal(windowEvents.size + documentEvents.size, 0, 'Unmount removes release listeners')
console.log('PASS hold-to-speak pointer, keyboard, global release, latest callback, disable and unmount behavior')

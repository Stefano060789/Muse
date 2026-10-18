const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.dictation-tests-'))
const originalLoad = Module._load
const originalWindow = global.window
const originalSetTimeout = global.setTimeout, originalClearTimeout = global.clearTimeout
const timers = new Map()
let nextTimer = 0
try {
  execFileSync(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/useStoryInteraction.ts', '--outDir', output, '--module', 'commonjs',
    '--target', 'es2020', '--skipLibCheck', '--noEmit', 'false'], { cwd: root, stdio: 'inherit' })
  const states = []
  const refs = []
  global.setTimeout = (callback, delay) => { assert.equal(delay, 1500); timers.set(++nextTimer, callback); return nextTimer }
  global.clearTimeout = id => timers.delete(id)
  Module._load = function (name, ...args) {
    if (name === 'react') return {
      useState: initial => { const slot = { value: initial }; states.push(slot); return [initial, value => { slot.value = value }] },
      useRef: initial => { const slot = { current: initial }; refs.push(slot); return slot },
      useEffect: () => {}
    }
    return originalLoad.call(this, name, ...args)
  }
  let current
  global.window = { SpeechRecognition: class {
    constructor() { current = this }
    start() {}
    stop() { this.stopped = true }
    abort() { this.aborted = true }
  } }
  const { useStoryInteraction } = require(path.join(output, 'useStoryInteraction.js'))
  const hook = useStoryInteraction(undefined, 'it-IT')
  let text = ''
  hook.dictate('creatorName', value => { text = value }, true)
  assert.equal(current.continuous, false)
  assert.equal(current.lang, 'it-IT')
  current.onaudiostart()
  assert.equal(states[2].value, true)
  current.onresult({ results: [[{ transcript: 'Stefano' }]] })
  assert.equal(text, 'Stefano')
  current.onend()
  assert.equal(timers.size, 0, 'Normal completion clears the final transcript timeout')
  assert.equal(states[0].value, '')
  assert.equal(states[2].value, false)
  hook.dictate('recipientName', value => { text = value }, true)
  const old = current
  old.onerror({ error: 'network' })
  assert.match(states[1].value, /regular Microsoft Edge or Google Chrome/)
  old.onend()
  assert.match(states[1].value, /could not connect/)
  hook.dictate('setting', value => { text = value })
  assert.equal(current.continuous, true)
  hook.stopRecording('setting')
  assert.equal(current.stopped, true, 'Releasing hold-to-speak stops recognition immediately')
  assert.equal(states[0].value, '', 'Stop listening clears the active recording target immediately')
  current.onresult({ results: [[{ transcript: ' final words' }]] })
  assert.equal(text, 'final words', 'The final recognition result is retained when hold-to-speak is released')
  current.onend()
  assert.equal(timers.size, 0, 'Released recording completion clears its timeout')
  assert.equal(states[1].value, '', 'Intentional stop does not surface a no-speech error')
  hook.dictate('response', value => { text = value })
  hook.stopRecording('response')
  current.onaudiostart()
  assert.equal(states[2].value, false, 'Late microphone startup cannot re-enable recording after release')
  hook.cancelRecording()
  const afterTyping = text
  current.onresult({ results: [[{ transcript: 'late words after typing' }]] })
  assert.equal(text, afterTyping, 'Typing or submitting cancels late transcripts')
  assert.equal(timers.size, 0, 'Cancelling clears the pending timeout')
  hook.dictate('response', value => { text = value })
  hook.stopRecording('response')
  const unfinished = current
  assert.equal(timers.size, 1)
  timers.values().next().value()
  assert.equal(unfinished.aborted, true, 'Recognition that never ends is forcibly cancelled')
  unfinished.onresult({ results: [[{ transcript: 'late words after timeout' }]] })
  assert.equal(text, afterTyping, 'Timed-out recognition cannot overwrite text')
  const before = text
  old.onresult({ results: [[{ transcript: 'stale result' }]] })
  assert.equal(text, before)
  hook.dictate('recipientName', () => {}, true)
  current.onerror({ error: 'not-allowed' })
  assert.match(states[1].value, /access was denied/)
  hook.dictate('recipientName', () => {}, true)
  current.onend()
  assert.match(states[1].value, /No words were received/)
  console.log('PASS name dictation, stale callback isolation, network/permission/no-result guidance')
} finally {
  Module._load = originalLoad
  global.window = originalWindow
  global.setTimeout = originalSetTimeout
  global.clearTimeout = originalClearTimeout
  fs.rmSync(output, { recursive: true, force: true })
}

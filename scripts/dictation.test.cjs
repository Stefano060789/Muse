const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.dictation-tests-'))
const originalLoad = Module._load
const originalWindow = global.window
try {
  execFileSync(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/useStoryInteraction.ts', '--outDir', output, '--module', 'commonjs',
    '--target', 'es2020', '--skipLibCheck', '--noEmit', 'false'], { cwd: root, stdio: 'inherit' })
  const states = []
  const refs = []
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
  hook.stopRecording()
  assert.equal(current.stopped, true, 'Releasing hold-to-speak stops recognition immediately')
  assert.equal(states[0].value, '', 'Stop listening clears the active recording target immediately')
  current.onresult({ results: [[{ transcript: ' final words' }]] })
  assert.equal(text, 'final words', 'The final recognition result is retained when hold-to-speak is released')
  current.onend()
  assert.equal(states[1].value, '', 'Intentional stop does not surface a no-speech error')
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
  fs.rmSync(output, { recursive: true, force: true })
}
